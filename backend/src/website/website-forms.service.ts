import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CandidatesService } from '../candidates/candidates.service';
import { LeadDuplicateService } from '../candidates/lead-duplicate.service';
import { buildSequence, normalizePhone } from '../pancake/pancake.util';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  BusinessContactDto,
  ListWebsiteContactsQueryDto,
  RegisterWorkerDto,
  UpdateWebsiteContactDto,
} from './dto/website-forms.dto';

/** Chống gửi dồn: mỗi địa chỉ IP tối đa 5 lần / 10 phút (cả 2 form cộng lại). */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
/** Cùng một số đăng ký lại trên web trong 24 giờ → không tạo data mới. */
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEBSITE_SOURCE_NAME = 'Website';

/**
 * Form trên trang web công ty (2026-11-16):
 * - Người lao động "Đăng ký tìm việc" → 1 data nguồn "Website", chia lần lượt cho các nhóm theo đúng
 *   tỉ lệ ở "Up tự động" (Pancake), dùng chung vòng chia; số trùng 7 ngày về nhóm đang giữ số.
 * - Doanh nghiệp "Gửi nhu cầu tuyển dụng" → bảng website_contacts + báo chuông Admin/Quản lý.
 */
@Injectable()
export class WebsiteFormsService {
  private readonly logger = new Logger(WebsiteFormsService.name);
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly duplicates: LeadDuplicateService,
    private readonly realtime: RealtimeService,
  ) {}

  private checkRate(ip: string): void {
    const now = Date.now();
    const recent = (this.hits.get(ip) ?? []).filter(
      (t) => now - t < RATE_WINDOW_MS,
    );
    if (recent.length >= RATE_MAX) {
      throw new HttpException(
        'Bạn gửi nhiều lần quá, vui lòng thử lại sau ít phút hoặc gọi hotline.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(ip, recent);
    if (this.hits.size > 5000) this.hits.clear();
  }

  private parsePhone(raw: string): string {
    const phone = normalizePhone(raw);
    if (!phone) throw new BadRequestException('Số điện thoại không hợp lệ');
    return phone;
  }

  /** Người lao động đăng ký tìm việc → data nguồn "Website". */
  async registerWorker(
    dto: RegisterWorkerDto,
    ip: string,
  ): Promise<{ ok: true }> {
    // Ô ẩn chống máy tự điền: có chữ → coi như đã nhận, không tạo gì.
    if (dto.website) return { ok: true };
    this.checkRate(ip);
    const phone = this.parsePhone(dto.phone);
    const name = dto.full_name.trim();

    const source = await this.prisma.leadSource.findFirst({
      where: { name: { equals: WEBSITE_SOURCE_NAME, mode: 'insensitive' } },
    });
    if (!source) {
      this.logger.error('Thiếu nguồn "Website" trong danh mục nguồn data');
      throw new BadRequestException(
        'Hệ thống chưa sẵn sàng, vui lòng gọi hotline.',
      );
    }

    const repeat = await this.prisma.lead.findFirst({
      where: {
        phoneNumber: phone,
        sourceId: source.id,
        deletedAt: null,
        uploadedAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (repeat) return { ok: true };

    const uploader = await this.prisma.account.findFirst({
      where: { role: 'admin', status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true },
    });
    if (!uploader)
      throw new BadRequestException(
        'Hệ thống chưa sẵn sàng, vui lòng gọi hotline.',
      );

    const teamId = await this.pickTeam(phone);
    if (!teamId)
      throw new BadRequestException(
        'Hệ thống chưa sẵn sàng, vui lòng gọi hotline.',
      );

    const area = dto.area?.trim();
    await this.candidates.create(
      {
        full_name: name,
        phone_number: phone,
        source_id: source.id,
        team_id: teamId,
        mkt_note:
          `Đăng ký từ website${area ? ` · Muốn làm: ${area}` : ''}`.slice(
            0,
            500,
          ),
      },
      { id: uploader.id, role: uploader.role, sessionId: 'website-form' },
    );
    return { ok: true };
  }

  /**
   * Nhóm nhận data: số trùng 7 ngày → nhóm đang giữ số; còn lại xoay vòng theo tỉ lệ "Up tự động"
   * (dùng chung bộ đếm với Pancake). Chưa đặt tỉ lệ nào → xoay vòng đều mọi nhóm.
   */
  private async pickTeam(phone: string): Promise<string | null> {
    const origin = await this.duplicates.findOriginTeam(phone);
    if (origin) return origin.id;

    const weights = await this.prisma.pancakeAutoUpTeam.findMany({
      where: { weight: { gt: 0 } },
      orderBy: { orderIndex: 'asc' },
    });
    let sequence = buildSequence(weights);
    if (sequence.length === 0) {
      const teams = await this.prisma.team.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      sequence = teams.map((t) => t.id);
    }
    if (sequence.length === 0) return null;

    let config = await this.prisma.pancakeAutoUpConfig.findFirst();
    if (!config) {
      config = await this.prisma.pancakeAutoUpConfig.create({ data: {} });
    }
    const next = await this.prisma.pancakeAutoUpConfig.update({
      where: { id: config.id },
      data: { position: { increment: 1 } },
    });
    return sequence[(next.position - 1) % sequence.length];
  }

  /** Doanh nghiệp gửi nhu cầu → lưu + báo chuông Admin/Quản lý. */
  async contactBusiness(
    dto: BusinessContactDto,
    ip: string,
  ): Promise<{ ok: true }> {
    if (dto.website) return { ok: true };
    this.checkRate(ip);
    const phone = this.parsePhone(dto.phone);
    const contact = await this.prisma.websiteContact.create({
      data: {
        companyName: dto.company_name.trim(),
        phone,
        need: dto.need?.trim() || null,
      },
    });
    await this.notifyManagers(contact.companyName, phone);
    return { ok: true };
  }

  private async notifyManagers(company: string, phone: string): Promise<void> {
    try {
      const recipients = await this.prisma.account.findMany({
        where: { role: { in: ['admin', 'manager'] }, status: 'active' },
        select: { id: true },
      });
      const now = new Date();
      for (const r of recipients) {
        const notification = await this.prisma.notification.create({
          data: {
            accountId: r.id,
            type: 'website_contact',
            channel: 'in_app',
            content:
              `Doanh nghiệp gửi nhu cầu tuyển dụng từ website: ${company} (${phone})`.slice(
                0,
                500,
              ),
            scheduledAt: now,
            sentAt: now,
            status: 'sent',
            meta: { link: '/website-contacts' },
          },
          include: {
            sender: {
              select: { id: true, fullName: true, role: true, avatarUrl: true },
            },
          },
        });
        this.realtime.emitNotificationCreated(
          toNotificationResponse(notification),
          null,
        );
      }
    } catch (error) {
      this.logger.error(
        'Gửi thông báo liên hệ từ website thất bại',
        error as Error,
      );
    }
  }

  async listContacts(query: ListWebsiteContactsQueryDto) {
    const where =
      query.status === 'pending'
        ? { handledAt: null }
        : query.status === 'handled'
          ? { handledAt: { not: null } }
          : {};
    const [total, rows, pending] = await this.prisma.$transaction([
      this.prisma.websiteContact.count({ where }),
      this.prisma.websiteContact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
      this.prisma.websiteContact.count({ where: { handledAt: null } }),
    ]);
    const handlerIds = [
      ...new Set(
        rows.map((r) => r.handledById).filter((x): x is string => !!x),
      ),
    ];
    const handlers = handlerIds.length
      ? await this.prisma.account.findMany({
          where: { id: { in: handlerIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameOf = new Map(handlers.map((h) => [h.id, h.fullName]));
    return {
      total,
      pending,
      page: query.page,
      page_size: query.page_size,
      data: rows.map((r) => ({
        id: r.id,
        company_name: r.companyName,
        phone: r.phone,
        need: r.need,
        note: r.note,
        created_at: r.createdAt.toISOString(),
        handled_at: r.handledAt?.toISOString() ?? null,
        handled_by_name: r.handledById
          ? (nameOf.get(r.handledById) ?? null)
          : null,
      })),
    };
  }

  async updateContact(
    id: string,
    dto: UpdateWebsiteContactDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.websiteContact.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy liên hệ');
    await this.prisma.websiteContact.update({
      where: { id },
      data: {
        ...(dto.handled === undefined
          ? {}
          : dto.handled
            ? {
                handledAt: existing.handledAt ?? new Date(),
                handledById: existing.handledById ?? user.id,
              }
            : { handledAt: null, handledById: null }),
        ...(dto.note === undefined ? {} : { note: dto.note.trim() || null }),
      },
    });
    return { ok: true };
  }
}

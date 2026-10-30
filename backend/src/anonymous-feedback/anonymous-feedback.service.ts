import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CreateAnonymousFeedbackDto } from './dto/create-anonymous-feedback.dto';
import { ListAnonymousFeedbackQueryDto } from './dto/list-anonymous-feedback-query.dto';
import {
  ANONYMOUS_FEEDBACK_PUBLIC_SELECT,
  AnonymousFeedbackRecipientDto,
  AnonymousFeedbackResponseDto,
  toAnonymousFeedbackResponse,
} from './dto/anonymous-feedback-response.dto';

/** Chỉ Quản lý/Admin xem đơn; mọi vai trò còn lại (nhân viên + Leader) được gửi. */
const VIEW_ROLES = new Set(['admin', 'manager']);

/** Ảnh đính kèm (2026-10-30): tối đa 5 ảnh, mỗi ảnh tối đa 5MB. */
export const FEEDBACK_MAX_IMAGES = 5;
export const FEEDBACK_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Thư mục RIÊNG, KHÔNG nằm trong uploads/ (thư mục đó phục vụ tĩnh công
 * khai) — ảnh chỉ tải được qua API có kiểm tra người nhận.
 */
const IMAGE_DIR = join(process.cwd(), 'private-uploads', 'anonymous-feedback');

const TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Nhận diện ảnh theo vài byte đầu (không tin mimetype trình duyệt gửi lên). */
export function detectImageExt(buffer: Buffer): string | null {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return '.jpg';
  }
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(pngSignature)) {
    return '.png';
  }
  if (
    buffer.length > 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp';
  }
  return null;
}

/**
 * Đơn phản ánh ẩn danh (2026-10-28, yêu cầu trực tiếp người dùng).
 *
 * Nguyên tắc ẩn danh đã chốt: người gửi ĐƯỢC lưu trong DB (sender_id) nhưng
 * KHÔNG lộ ra ở bất kỳ đâu Quản lý/Admin nhìn thấy được:
 * - API trả đơn chỉ chọn ANONYMOUS_FEEDBACK_PUBLIC_SELECT (không có sender).
 * - Thông báo cho Quản lý/Admin để sender_id = null.
 * - Sự kiện realtime phát với actor = null.
 * - KHÔNG ghi audit_logs (trang Nhật ký của Admin hiện người thao tác) và
 *   không ghi log có thông tin người gửi.
 * - Người gửi cũng không xem lại được đơn đã gửi (không có API cho họ).
 *
 * 2026-10-30: nhân viên chọn người nhận (Admin/Quản lý cụ thể, hoặc tất cả)
 * — chỉ người nhận xem được đơn/ảnh và nhận thông báo. Đính kèm tối đa 5
 * ảnh, tên file ngẫu nhiên; trình duyệt đã vẽ lại ảnh để xoá thông tin
 * máy/GPS trước khi gửi.
 */
@Injectable()
export class AnonymousFeedbackService {
  private readonly logger = new Logger(AnonymousFeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Danh sách người nhận có thể chọn: Admin/Quản lý đang hoạt động. */
  async listRecipients(): Promise<AnonymousFeedbackRecipientDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { role: { in: ['admin', 'manager'] }, status: 'active' },
      select: { id: true, fullName: true, role: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
    return accounts.map((a) => ({
      id: a.id,
      full_name: a.fullName,
      role: a.role,
    }));
  }

  async create(
    dto: CreateAnonymousFeedbackDto,
    currentUser: AuthenticatedUser,
    images: Express.Multer.File[] = [],
  ): Promise<{ message: string }> {
    if (VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException(
        'Quản lý/Admin là người nhận đơn phản ánh, không gửi đơn',
      );
    }
    const subject = dto.subject.trim();
    const content = dto.content.trim();
    if (!subject || !content) {
      throw new BadRequestException(
        'Vui lòng nhập đủ tiêu đề và nội dung phản ánh',
      );
    }
    const recipientIds = await this.parseRecipients(dto.recipient_ids);
    if (images.length > FEEDBACK_MAX_IMAGES) {
      throw new BadRequestException(
        `Chỉ đính kèm tối đa ${FEEDBACK_MAX_IMAGES} ảnh`,
      );
    }
    const exts = images.map((file) => detectImageExt(file.buffer));
    if (exts.some((ext) => !ext)) {
      throw new BadRequestException(
        'Chỉ chấp nhận ảnh định dạng JPEG, PNG hoặc WebP',
      );
    }

    // Ghi ảnh trước (tên ngẫu nhiên, không chứa thông tin người gửi); lưu
    // đơn lỗi thì dọn các ảnh đã ghi.
    const imageFiles: string[] = [];
    let created: { id: string; subject: string };
    try {
      if (images.length) await mkdir(IMAGE_DIR, { recursive: true });
      for (let i = 0; i < images.length; i++) {
        const name = `${randomUUID()}${exts[i]}`;
        await writeFile(join(IMAGE_DIR, name), images[i].buffer);
        imageFiles.push(name);
      }
      created = await this.prisma.anonymousFeedback.create({
        data: {
          senderId: currentUser.id,
          subject,
          content,
          recipientIds,
          imageFiles,
        },
        select: { id: true, subject: true },
      });
    } catch (error) {
      await Promise.all(
        imageFiles.map((name) =>
          unlink(join(IMAGE_DIR, name)).catch(() => undefined),
        ),
      );
      throw error;
    }

    await this.notifyViewers(created.id, created.subject, recipientIds);
    return { message: 'Đã gửi đơn phản ánh ẩn danh' };
  }

  async list(
    query: ListAnonymousFeedbackQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<AnonymousFeedbackResponseDto[]> {
    this.assertViewer(currentUser);
    const where: Prisma.AnonymousFeedbackWhereInput = {
      ...this.visibleWhere(currentUser),
    };
    if (query.date_from || query.date_to) {
      where.createdAt = {
        gte: query.date_from ? new Date(query.date_from) : undefined,
        lte: query.date_to ? new Date(query.date_to) : undefined,
      };
    }
    const rows = await this.prisma.anonymousFeedback.findMany({
      where,
      select: ANONYMOUS_FEEDBACK_PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    const byId = await this.recipientsById(rows.flatMap((r) => r.recipientIds));
    return rows.map((r) => toAnonymousFeedbackResponse(r, byId));
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<AnonymousFeedbackResponseDto> {
    const row = await this.findVisible(id, currentUser);
    return toAnonymousFeedbackResponse(
      row,
      await this.recipientsById(row.recipientIds),
    );
  }

  /** GET /anonymous-feedback/:id/images/:index — chỉ người nhận đơn tải được ảnh. */
  async getImage(
    id: string,
    index: number,
    currentUser: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const row = await this.findVisible(id, currentUser);
    const name = row.imageFiles[index];
    // Tên file do hệ thống đặt (uuid + đuôi) — chặn thêm mọi ký tự đường dẫn.
    if (!name || !/^[\w-]+\.(jpg|png|webp)$/.test(name)) {
      throw new NotFoundException('Không tìm thấy ảnh');
    }
    const ext = name.slice(name.lastIndexOf('.'));
    return new StreamableFile(createReadStream(join(IMAGE_DIR, name)), {
      type: TYPE_BY_EXT[ext],
    });
  }

  private assertViewer(currentUser: AuthenticatedUser): void {
    if (!VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Chỉ Quản lý/Admin xem được đơn phản ánh');
    }
  }

  private async findVisible(id: string, currentUser: AuthenticatedUser) {
    this.assertViewer(currentUser);
    const row = await this.prisma.anonymousFeedback.findFirst({
      where: { id, ...this.visibleWhere(currentUser) },
      select: ANONYMOUS_FEEDBACK_PUBLIC_SELECT,
    });
    if (!row) throw new NotFoundException('Không tìm thấy đơn phản ánh');
    return row;
  }

  /** Đơn gửi tất cả (không chọn ai) hoặc có chọn đúng người đang xem. */
  private visibleWhere(
    currentUser: AuthenticatedUser,
  ): Prisma.AnonymousFeedbackWhereInput {
    return {
      OR: [
        { recipientIds: { isEmpty: true } },
        { recipientIds: { has: currentUser.id } },
      ],
    };
  }

  private async recipientsById(
    ids: string[],
  ): Promise<Map<string, AnonymousFeedbackRecipientDto>> {
    if (!ids.length) return new Map();
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, fullName: true, role: true },
    });
    return new Map(
      accounts.map((a) => [
        a.id,
        { id: a.id, full_name: a.fullName, role: a.role },
      ]),
    );
  }

  /** "[]"/trống = tất cả; còn lại phải đều là Admin/Quản lý đang hoạt động. */
  private async parseRecipients(raw: string | undefined): Promise<string[]> {
    if (!raw || !raw.trim()) return [];
    let ids: unknown;
    try {
      ids = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Danh sách người nhận không hợp lệ');
    }
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) {
      throw new BadRequestException('Danh sách người nhận không hợp lệ');
    }
    const unique = [...new Set(ids as string[])];
    if (!unique.length) return [];
    const valid = await this.prisma.account.count({
      where: {
        id: { in: unique },
        role: { in: ['admin', 'manager'] },
        status: 'active',
      },
    });
    if (valid !== unique.length) {
      throw new BadRequestException(
        'Người nhận phải là Admin hoặc Quản lý đang hoạt động',
      );
    }
    return unique;
  }

  /**
   * Báo chuông cho người nhận đã chọn (không chọn ai = mọi Quản lý/Admin
   * đang hoạt động). sender_id = null và actor = null — tuyệt đối không gắn
   * thông tin người gửi. Lỗi gửi thông báo không làm hỏng việc gửi đơn.
   */
  private async notifyViewers(
    feedbackId: string,
    subject: string,
    recipientIds: string[],
  ) {
    try {
      const viewers = await this.prisma.account.findMany({
        where: {
          role: { in: ['admin', 'manager'] },
          status: 'active',
          ...(recipientIds.length ? { id: { in: recipientIds } } : {}),
        },
        select: { id: true },
      });
      const now = new Date();
      const content = `Có đơn phản ánh ẩn danh mới: ${subject}`.slice(0, 500);
      for (const viewer of viewers) {
        const notification = await this.prisma.notification.create({
          data: {
            accountId: viewer.id,
            type: 'anonymous_feedback_created',
            channel: 'in_app',
            content,
            senderId: null,
            scheduledAt: now,
            sentAt: now,
            status: 'sent',
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
      // Chỉ ghi id đơn — không ghi người gửi.
      this.logger.error(
        `Gửi thông báo đơn phản ánh ẩn danh thất bại (feedback=${feedbackId})`,
        error as Error,
      );
    }
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CandidatesService } from '../candidates/candidates.service';
import { LeadDuplicateService } from '../candidates/lead-duplicate.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { vnDayRange } from '../care-warehouse/care-time.util';
import { decryptToken, encryptToken } from '../marketing-hub/token-crypto';
import {
  PancakeApiError,
  PancakeConversation,
  listConversationsInRange,
  listRecentConversations,
  parsePancakeTime,
} from './pancake.client';
import {
  buildSequence,
  customerName,
  pageIdFromToken,
  pickPhone,
} from './pancake.util';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Lần đầu liên kết: lấy 30 ngày hội thoại cũ để có số thống kê (KHÔNG up data). */
const BASELINE_DAYS = 30;
const MAX_BASELINE_PAGES = 60;
const MAX_POLL_PAGES = 10;
const vnToday = () =>
  new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const vnDaysAgo = (n: number) =>
  new Date(Date.now() + 7 * 3600_000 - n * DAY_MS).toISOString().slice(0, 10);

type PageRow = {
  id: string;
  pageId: string;
  name: string;
  ownerId: string;
  mktSourceId: string | null;
};

@Injectable()
export class PancakeService {
  private readonly logger = new Logger(PancakeService.name);
  private polling = false;
  private readonly syncing = new Set<string>();
  private facebookSourceId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly candidates: CandidatesService,
    private readonly duplicates: LeadDuplicateService,
  ) {}

  private tokenKey(): string {
    const key = this.config.get<string>('MARKETING_TOKEN_KEY');
    if (!key || key.length < 32) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình MARKETING_TOKEN_KEY (≥ 32 ký tự) trên máy chủ',
      );
    }
    return key;
  }

  // ── Liên kết page ────────────────────────────────────────────────────────

  async connect(accessToken: string, name: string, user: AuthenticatedUser) {
    const key = this.tokenKey();
    const token = accessToken.trim();
    const pageId = pageIdFromToken(token);
    if (!pageId) {
      throw new BadRequestException(
        'Token không đúng dạng token page Pancake (Cài đặt page → Công cụ → API)',
      );
    }
    try {
      await listRecentConversations(pageId, token);
    } catch (e) {
      throw new BadRequestException(
        e instanceof PancakeApiError ? e.message : 'Không kết nối được Pancake',
      );
    }
    const existing = await this.prisma.pancakePage.findUnique({
      where: { pageId },
    });
    if (existing && existing.ownerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Page này đã có nhân viên khác phụ trách');
    }
    const data = {
      name: name.trim(),
      encryptedToken: encryptToken(token, key),
      status: 'connected' as const,
      lastError: null,
    };
    const row = existing
      ? await this.prisma.pancakePage.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.pancakePage.create({
          data: { ...data, pageId, ownerId: user.id },
        });
    await this.audit.log({
      accountId: user.id,
      actionType: existing ? 'update' : 'create',
      entityType: 'pancake_page',
      entityId: row.id,
      fieldChanged: 'connect',
      newValue: row.name,
    });
    // Lấy dữ liệu nền chạy ngầm (có thể vài chục giây), không bắt người dùng chờ.
    void this.syncPage(row.id);
    return { ok: true, id: row.id };
  }

  private async findPage(id: string) {
    const page = await this.prisma.pancakePage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Không tìm thấy page Pancake');
    return page;
  }

  async disconnect(id: string, user: AuthenticatedUser) {
    const page = await this.findPage(id);
    if (user.role !== 'admin' && page.ownerId !== user.id) {
      throw new ForbiddenException('Bạn chỉ được gỡ page của mình');
    }
    await this.prisma.pancakePage.update({
      where: { id },
      data: { encryptedToken: null, status: 'disconnected' },
    });
    await this.audit.log({
      accountId: user.id,
      actionType: 'delete',
      entityType: 'pancake_page',
      entityId: id,
      fieldChanged: 'disconnect',
      oldValue: page.name,
    });
    return { ok: true };
  }

  async changeOwner(id: string, ownerId: string, user: AuthenticatedUser) {
    const [page, owner] = await Promise.all([
      this.findPage(id),
      this.prisma.account.findUnique({ where: { id: ownerId } }),
    ]);
    if (
      !owner ||
      owner.status !== 'active' ||
      !['mkt', 'admin', 'manager'].includes(owner.role)
    ) {
      throw new BadRequestException(
        'Nhân viên phụ trách phải là Admin, Quản lý hoặc MKT đang hoạt động',
      );
    }
    await this.prisma.pancakePage.update({ where: { id }, data: { ownerId } });
    await this.audit.log({
      accountId: user.id,
      actionType: 'assign',
      entityType: 'pancake_page',
      entityId: id,
      fieldChanged: 'owner_id',
      oldValue: page.ownerId,
      newValue: ownerId,
    });
    return { ok: true };
  }

  async setMktSource(
    id: string,
    mktSourceId: string | null,
    user: AuthenticatedUser,
  ) {
    const page = await this.findPage(id);
    if (
      mktSourceId &&
      !(await this.prisma.mktSource.findUnique({ where: { id: mktSourceId } }))
    ) {
      throw new BadRequestException('Nguồn MKT không tồn tại');
    }
    await this.prisma.pancakePage.update({
      where: { id },
      data: { mktSourceId },
    });
    await this.audit.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'pancake_page',
      entityId: id,
      fieldChanged: 'mkt_source_id',
      oldValue: page.mktSourceId ?? undefined,
      newValue: mktSourceId ?? undefined,
    });
    return { ok: true };
  }

  // ── Thống kê theo page ───────────────────────────────────────────────────

  /**
   * Theo từng page trong kỳ (giờ VN): người nhắn mới = hội thoại INBOX bắt đầu trong kỳ;
   * để lại SĐT = trong số đó, hội thoại Pancake đã bắt được SĐT; data đã up = data tự động
   * tạo trong kỳ (cả inbox và bình luận).
   */
  async listPages(from?: string, to?: string) {
    const t = to ?? vnToday();
    const f = from ?? vnDaysAgo(29);
    if (f > t)
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    const range = { gte: vnDayRange(f).start, lt: vnDayRange(t).end };
    const pages = await this.prisma.pancakePage.findMany({
      include: {
        owner: { select: { id: true, fullName: true } },
        mktSource: { select: { id: true, name: true } },
      },
      orderBy: [{ owner: { fullName: 'asc' } }, { name: 'asc' }],
    });
    const count = async (where: object) =>
      new Map(
        (
          await this.prisma.pancakeConversation.groupBy({
            by: ['pancakePageId'],
            where,
            _count: { _all: true },
          })
        ).map((r) => [r.pancakePageId, r._count._all]),
      );
    const [messages, phones, leads] = await Promise.all([
      count({ type: 'INBOX', startedAt: range }),
      count({ type: 'INBOX', startedAt: range, phoneNumber: { not: null } }),
      count({ leadId: { not: null }, lead: { uploadedAt: range } }),
    ]);
    return {
      from: f,
      to: t,
      items: pages.map((p) => {
        const m = messages.get(p.id) ?? 0;
        const ph = phones.get(p.id) ?? 0;
        return {
          id: p.id,
          page_id: p.pageId,
          name: p.name,
          owner: { id: p.owner.id, full_name: p.owner.fullName },
          mkt_source: p.mktSource,
          status: p.status,
          synced: p.cursorAt !== null,
          last_sync_at: p.lastSyncAt?.toISOString() ?? null,
          last_error: p.lastError,
          message_count: m,
          phone_count: ph,
          phone_rate: m > 0 ? ph / m : null,
          lead_count: leads.get(p.id) ?? 0,
        };
      }),
    };
  }

  // ── Cài đặt Up tự động ───────────────────────────────────────────────────

  async getAutoUp() {
    const [config, teams, weights] = await Promise.all([
      this.prisma.pancakeAutoUpConfig.findFirst(),
      this.prisma.team.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.pancakeAutoUpTeam.findMany(),
    ]);
    const byTeam = new Map(weights.map((w) => [w.teamId, w]));
    // Nhóm đã cấu hình giữ thứ tự cũ; nhóm mới tạo nối vào cuối với tỉ lệ 0.
    const ordered = [...teams].sort(
      (a, b) =>
        (byTeam.get(a.id)?.orderIndex ?? 10_000) -
        (byTeam.get(b.id)?.orderIndex ?? 10_000),
    );
    return {
      is_active: config?.isActive ?? false,
      activated_at: config?.activatedAt?.toISOString() ?? null,
      teams: ordered.map((t) => ({
        team_id: t.id,
        name: t.name,
        weight: byTeam.get(t.id)?.weight ?? 0,
      })),
    };
  }

  async saveAutoUp(
    isActive: boolean,
    teams: { team_id: string; weight: number }[],
    user: AuthenticatedUser,
  ) {
    const ids = teams.map((t) => t.team_id);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Có nhóm bị lặp');
    const found = await this.prisma.team.count({ where: { id: { in: ids } } });
    if (found !== ids.length)
      throw new BadRequestException('Có nhóm không tồn tại');
    const active = teams.filter((t) => t.weight > 0);
    if (isActive && active.length === 0) {
      throw new BadRequestException(
        'Chọn ít nhất 1 nhóm nhận số trước khi bật Up tự động',
      );
    }
    const before = await this.getAutoUp();
    const sig = (list: { team_id: string; weight: number }[]) =>
      list
        .filter((t) => t.weight > 0)
        .map((t) => `${t.team_id}:${t.weight}`)
        .join(',');
    const ratioChanged = sig(before.teams) !== sig(teams);
    const existing = await this.prisma.pancakeAutoUpConfig.findFirst();

    await this.prisma.$transaction(async (tx) => {
      await tx.pancakeAutoUpTeam.deleteMany({});
      if (active.length > 0) {
        await tx.pancakeAutoUpTeam.createMany({
          data: teams.map((t, i) => ({
            teamId: t.team_id,
            weight: t.weight,
            orderIndex: i,
          })),
        });
      }
      const data = {
        isActive,
        updatedById: user.id,
        // Đổi tỉ lệ → bắt đầu vòng chia mới từ nhóm đầu tiên.
        ...(ratioChanged ? { position: 0 } : {}),
        ...(isActive && !existing?.isActive ? { activatedAt: new Date() } : {}),
      };
      if (existing) {
        await tx.pancakeAutoUpConfig.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await tx.pancakeAutoUpConfig.create({ data });
      }
    });
    const names = new Map(before.teams.map((t) => [t.team_id, t.name]));
    const describe = (
      on: boolean,
      list: { team_id: string; weight: number }[],
    ) =>
      `${on ? 'Bật' : 'Tắt'}; ${
        list
          .filter((t) => t.weight > 0)
          .map((t) => `${names.get(t.team_id) ?? t.team_id}=${t.weight}`)
          .join(', ') || 'chưa chọn nhóm'
      }`;
    await this.audit.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'pancake_auto_up',
      entityId: user.id,
      fieldChanged: 'config',
      oldValue: describe(before.is_active, before.teams),
      newValue: describe(isActive, teams),
    });
    return this.getAutoUp();
  }

  // ── Đồng bộ ──────────────────────────────────────────────────────────────

  /** Đọc Pancake mỗi 10 giây để số mới lên gần như ngay lập tức. */
  @Interval(10_000)
  async pollAll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const pages = await this.prisma.pancakePage.findMany({
        where: { status: 'connected', encryptedToken: { not: null } },
        select: { id: true },
      });
      for (const { id } of pages) await this.syncPage(id);
    } catch (e) {
      this.logger.error('Đọc Pancake lỗi', e as Error);
    } finally {
      this.polling = false;
    }
  }

  /** Đồng bộ 1 page; lỗi ghi vào last_error, không ném ra ngoài. */
  async syncPage(id: string): Promise<void> {
    if (this.syncing.has(id)) return;
    this.syncing.add(id);
    try {
      const page = await this.prisma.pancakePage.findUnique({ where: { id } });
      if (!page?.encryptedToken) return;
      try {
        const token = decryptToken(page.encryptedToken, this.tokenKey());
        const cursorAt = page.cursorAt
          ? await this.pollRecent(page, token, page.cursorAt)
          : await this.baseline(page, token);
        await this.prisma.pancakePage.update({
          where: { id },
          data: {
            cursorAt,
            lastSyncAt: new Date(),
            status: 'connected',
            lastError: null,
          },
        });
      } catch (e) {
        const invalid = e instanceof PancakeApiError && e.isTokenInvalid;
        const message =
          e instanceof PancakeApiError
            ? e.message
            : 'Đồng bộ thất bại (lỗi hệ thống)';
        if (!(e instanceof PancakeApiError)) {
          this.logger.error(`Đồng bộ page Pancake ${id} lỗi`, e as Error);
        }
        if (page.lastError !== message || invalid) {
          await this.prisma.pancakePage.update({
            where: { id },
            data: {
              status: invalid ? 'error' : page.status,
              lastError: message.slice(0, 500),
            },
          });
        }
      }
    } finally {
      this.syncing.delete(id);
    }
  }

  /** Lần đầu: ghi nhận hội thoại 30 ngày qua để thống kê, KHÔNG up data. Trả mốc cursor. */
  private async baseline(page: PageRow, token: string): Promise<Date> {
    const until = Math.floor(Date.now() / 1000);
    const since = until - BASELINE_DAYS * 86400;
    let cursor = new Date(0);
    let seen = 0;
    for (let n = 1; n <= MAX_BASELINE_PAGES; n++) {
      const r = await listConversationsInRange(
        page.pageId,
        token,
        since,
        until,
        n,
      );
      for (const c of r.conversations) {
        await this.recordConversation(page, c, false);
        const u = parsePancakeTime(c.updated_at);
        if (u > cursor) cursor = u;
      }
      seen += r.conversations.length;
      if (r.conversations.length === 0 || seen >= r.total) break;
    }
    return cursor.getTime() > 0 ? cursor : new Date();
  }

  /** Hội thoại cập nhật sau mốc cursor (cũ trước, mới sau). Trả mốc cursor mới. */
  private async pollRecent(
    page: PageRow,
    token: string,
    cursorAt: Date,
  ): Promise<Date> {
    const fresh = new Map<string, PancakeConversation>();
    let last: string | undefined;
    for (let i = 0; i < MAX_POLL_PAGES; i++) {
      const batch = await listRecentConversations(page.pageId, token, last);
      for (const c of batch) {
        if (parsePancakeTime(c.updated_at) > cursorAt) fresh.set(c.id, c);
      }
      const oldest = batch[batch.length - 1];
      if (!oldest || parsePancakeTime(oldest.updated_at) <= cursorAt) break;
      last = oldest.id;
    }
    const list = [...fresh.values()].sort(
      (a, b) =>
        parsePancakeTime(a.updated_at).getTime() -
        parsePancakeTime(b.updated_at).getTime(),
    );
    let cursor = cursorAt;
    for (const c of list) {
      await this.recordConversation(page, c, true);
      const u = parsePancakeTime(c.updated_at);
      if (u > cursor) cursor = u;
    }
    return cursor;
  }

  /**
   * Lưu hội thoại; lần ĐẦU thấy SĐT trong hội thoại và được phép (không phải lấy dữ liệu nền)
   * thì thử up tự động. SĐT thấy lúc Up tự động đang tắt cũng được ghi nhận → bật lại không lấy bù.
   */
  private async recordConversation(
    page: PageRow,
    c: PancakeConversation,
    allowLead: boolean,
  ): Promise<void> {
    const phone = pickPhone(c);
    const where = {
      pancakePageId_conversationId: {
        pancakePageId: page.id,
        conversationId: c.id,
      },
    };
    const existing = await this.prisma.pancakeConversation.findUnique({
      where,
    });
    if (existing?.phoneNumber || (existing && !phone)) return;
    const row = existing
      ? await this.prisma.pancakeConversation.update({
          where: { id: existing.id },
          data: { phoneNumber: phone, phoneSeenAt: new Date() },
        })
      : await this.prisma.pancakeConversation.create({
          data: {
            pancakePageId: page.id,
            conversationId: c.id,
            type: (c.type || 'INBOX').slice(0, 16),
            startedAt: parsePancakeTime(c.inserted_at),
            phoneNumber: phone,
            phoneSeenAt: phone ? new Date() : null,
          },
        });
    if (phone && allowLead) {
      try {
        await this.autoUp(page, row.id, phone, customerName(c));
      } catch (e) {
        this.logger.error(
          `Up tự động lỗi (page ${page.name}, hội thoại ${c.id})`,
          e as Error,
        );
      }
    }
  }

  private async getFacebookSourceId(): Promise<string | null> {
    if (this.facebookSourceId) return this.facebookSourceId;
    const src = await this.prisma.leadSource.findFirst({
      where: { name: { equals: 'Facebook', mode: 'insensitive' } },
    });
    this.facebookSourceId = src?.id ?? null;
    return this.facebookSourceId;
  }

  /** Tạo data như nhập tay (lọc trùng 30 ngày, chia trong nhóm, thông báo). Số trùng không tính lượt. */
  private async autoUp(
    page: PageRow,
    conversationRowId: string,
    phone: string,
    name: string,
  ): Promise<void> {
    const config = await this.prisma.pancakeAutoUpConfig.findFirst();
    if (!config?.isActive) return;
    const weights = await this.prisma.pancakeAutoUpTeam.findMany({
      where: { weight: { gt: 0 } },
      orderBy: { orderIndex: 'asc' },
    });
    const sequence = buildSequence(weights);
    if (sequence.length === 0) return;
    const sourceId = await this.getFacebookSourceId();
    if (!sourceId) {
      this.logger.warn('Không có nguồn "Facebook" trong danh mục — bỏ qua');
      return;
    }
    const owner = await this.prisma.account.findUnique({
      where: { id: page.ownerId },
      select: { id: true, role: true },
    });
    if (!owner) return;

    const origin = await this.duplicates.findOriginTeam(phone);
    let teamId: string;
    if (origin) {
      teamId = origin.id;
    } else {
      const next = await this.prisma.pancakeAutoUpConfig.update({
        where: { id: config.id },
        data: { position: { increment: 1 } },
      });
      teamId = sequence[(next.position - 1) % sequence.length];
    }
    const result = await this.candidates.create(
      {
        full_name: name,
        phone_number: phone,
        source_id: sourceId,
        team_id: teamId,
        mkt_source_id: page.mktSourceId ?? undefined,
      },
      { id: owner.id, role: owner.role, sessionId: 'pancake-auto-up' },
    );
    await this.prisma.pancakeConversation.update({
      where: { id: conversationRowId },
      data: { leadId: result.candidate.id },
    });
  }
}

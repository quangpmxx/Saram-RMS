import { can } from '../common/permissions/capability-catalog';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { vnDayRange } from '../care-warehouse/care-time.util';
import { decryptToken, encryptToken } from './token-crypto';
import {
  FacebookApiError,
  FbAdAccount,
  fetchAccountHealth,
  fetchAdInfo,
  fetchDailySpend,
  listAdAccounts,
} from './facebook-ads.client';
import {
  MarketingPeriodQueryDto,
  OverviewQueryDto,
} from './dto/marketing-hub.dto';
import { countShuttlePersons } from '../shuttle/shuttle-person.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_SYNC_DAYS = 30;
const RESYNC_DAYS = 3; // Meta có thể điều chỉnh số liệu những ngày gần nhất
const vnToday = () =>
  new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const vnDaysAgo = (n: number) =>
  new Date(Date.now() + 7 * 3600_000 - n * DAY_MS).toISOString().slice(0, 10);

/** Mốc cảnh báo số dư giới hạn chi tiêu (VNĐ), từ cao xuống thấp. */
export const BALANCE_ALERT_LEVELS = [1_000_000, 800_000, 500_000, 200_000];

/** Số dư còn lại của giới hạn chi tiêu; null = tài khoản không đặt giới hạn. */
export function balanceOf(
  cap: number | null | { toString(): string },
  spent: number | null | { toString(): string },
): number | null {
  const c = cap === null ? 0 : Number(cap);
  if (!(c > 0)) return null;
  return Math.max(0, c - (spent === null ? 0 : Number(spent)));
}

/** account_status Facebook → Live ADS / Chưa thanh toán / Die ADS. */
export function accountHealth(
  code: number | null,
): 'live' | 'unpaid' | 'die' | null {
  if (code === null) return null;
  if (code === 1 || code === 201) return 'live'; // ACTIVE, ANY_ACTIVE
  if ([3, 8, 9].includes(code)) return 'unpaid'; // UNSETTLED, PENDING_SETTLEMENT, IN_GRACE_PERIOD
  return 'die'; // DISABLED, PENDING_RISK_REVIEW, CLOSED…
}

@Injectable()
export class MarketingHubService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MarketingHubService.name);
  private resolvingAds = false;
  /** Khoá trong bộ nhớ: không đồng bộ 2 lần cùng lúc 1 tài khoản (backend chạy 1 bản). */
  private readonly syncing = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Khởi động xong 30 giây thì tra camp cho mã quảng cáo chưa biết (không chặn khởi động). */
  onApplicationBootstrap(): void {
    setTimeout(() => void this.resolveUnknownAds(), 30_000).unref();
  }

  private tokenKey(): string {
    const key = this.config.get<string>('MARKETING_TOKEN_KEY');
    if (!key || key.length < 32) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình MARKETING_TOKEN_KEY (≥ 32 ký tự) trên máy chủ',
      );
    }
    return key;
  }

  private assertCanManage(
    account: { ownerId: string },
    user: AuthenticatedUser,
  ) {
    if (!can(user, 'mkt.assign_owner') && account.ownerId !== user.id) {
      throw new ForbiddenException(
        'Bạn chỉ được thao tác tài khoản quảng cáo của mình',
      );
    }
  }

  /** Liên kết bằng token: lấy các tài khoản VNĐ token truy cập được, mỗi tài khoản đúng 1 người phụ trách. */
  async connect(accessToken: string, user: AuthenticatedUser) {
    const key = this.tokenKey();
    let found: FbAdAccount[];
    try {
      found = await listAdAccounts(accessToken.trim());
    } catch (e) {
      throw new BadRequestException(
        e instanceof FacebookApiError
          ? `Facebook từ chối token: ${e.message}`
          : 'Không kết nối được tới Facebook',
      );
    }
    const encrypted = encryptToken(accessToken.trim(), key);
    const connected: string[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const fb of found) {
      if (fb.currency !== 'VND') {
        skipped.push({
          name: fb.name,
          reason: `Tiền tệ ${fb.currency}, hệ thống chỉ hỗ trợ VNĐ`,
        });
        continue;
      }
      const where = {
        platform_externalId: {
          platform: 'facebook' as const,
          externalId: fb.externalId,
        },
      };
      const existing = await this.prisma.adAccount.findUnique({ where });
      if (
        existing &&
        existing.ownerId !== user.id &&
        !can(user, 'mkt.assign_owner')
      ) {
        skipped.push({
          name: fb.name,
          reason: 'Đã có nhân viên khác phụ trách',
        });
        continue;
      }
      try {
        const row = existing
          ? await this.prisma.adAccount.update({
              where: { id: existing.id },
              data: {
                name: fb.name,
                encryptedToken: encrypted,
                status: 'connected',
                lastError: null,
              },
            })
          : await this.prisma.adAccount.create({
              data: {
                platform: 'facebook',
                externalId: fb.externalId,
                name: fb.name,
                currency: fb.currency,
                ownerId: user.id,
                encryptedToken: encrypted,
              },
            });
        connected.push(row.id);
        await this.audit.log({
          accountId: user.id,
          actionType: existing ? 'update' : 'create',
          entityType: 'ad_account',
          entityId: row.id,
          fieldChanged: 'connect',
          oldValue: undefined,
          newValue: fb.name,
        });
      } catch (e) {
        // Hai người cùng liên kết 1 tài khoản cùng lúc → unique (platform, externalId) chặn bản ghi trùng.
        if ((e as { code?: string }).code === 'P2002') {
          skipped.push({
            name: fb.name,
            reason: 'Đã có nhân viên khác phụ trách',
          });
        } else throw e;
      }
    }
    for (const id of connected) await this.syncById(id);
    return { connected: connected.length, skipped };
  }

  async syncNow(id: string, user: AuthenticatedUser) {
    const account = await this.prisma.adAccount.findUnique({ where: { id } });
    if (!account)
      throw new NotFoundException('Không tìm thấy tài khoản quảng cáo');
    this.assertCanManage(account, user);
    if (!account.encryptedToken)
      throw new BadRequestException('Tài khoản đã gỡ liên kết');
    if (this.syncing.has(id))
      throw new ConflictException('Đang đồng bộ, vui lòng chờ');
    await this.syncById(id);
    void this.resolveUnknownAds();
    return { ok: true };
  }

  /** Đồng bộ 1 tài khoản; lỗi được ghi vào last_error, không ném ra ngoài. */
  async syncById(id: string): Promise<void> {
    if (this.syncing.has(id)) return;
    this.syncing.add(id);
    try {
      const account = await this.prisma.adAccount.findUnique({ where: { id } });
      if (!account?.encryptedToken) return;
      try {
        const token = decryptToken(account.encryptedToken, this.tokenKey());
        const since = vnDaysAgo(
          account.lastSyncAt ? RESYNC_DAYS : FIRST_SYNC_DAYS,
        );
        const rows = await fetchDailySpend(
          token,
          account.externalId,
          since,
          vnToday(),
        );
        const health = await fetchAccountHealth(token, account.externalId);
        const remaining = balanceOf(health.spendCap, health.amountSpent);
        // Mốc thấp nhất mà số dư đang nằm dưới; tụt xuống mốc mới thấp hơn mốc đã báo thì báo lại.
        const newLevel =
          remaining === null
            ? null
            : ([...BALANCE_ALERT_LEVELS].reverse().find((l) => remaining < l) ??
              null);
        await this.prisma.$transaction(
          rows.map((r) =>
            this.prisma.adSpendDaily.upsert({
              where: {
                adAccountId_date: { adAccountId: id, date: new Date(r.date) },
              },
              create: {
                adAccountId: id,
                date: new Date(r.date),
                spend: r.spend,
                impressions: r.impressions,
                clicks: r.clicks,
              },
              update: {
                spend: r.spend,
                impressions: r.impressions,
                clicks: r.clicks,
                syncedAt: new Date(),
              },
            }),
          ),
        );
        await this.prisma.adAccount.update({
          where: { id },
          data: {
            status: 'connected',
            lastSyncAt: new Date(),
            lastError: null,
            fbAccountStatus: health.accountStatus,
            hasActiveCampaign: health.hasActiveCampaign,
            spendCap: health.spendCap,
            amountSpent: health.amountSpent,
            balanceAlertLevel: newLevel,
          },
        });
        if (newLevel !== null && remaining !== null) {
          const prev = account.balanceAlertLevel;
          if (prev === null || newLevel < prev)
            await this.notifyLowBalance(account, remaining, newLevel);
        }
      } catch (e) {
        const invalid = e instanceof FacebookApiError && e.isTokenInvalid;
        const message =
          e instanceof FacebookApiError
            ? e.message
            : 'Đồng bộ thất bại (lỗi hệ thống)';
        this.logger.warn(`Đồng bộ tài khoản quảng cáo ${id} lỗi: ${message}`);
        await this.prisma.adAccount.update({
          where: { id },
          data: {
            status: invalid ? 'error' : account.status,
            lastError: message.slice(0, 500),
          },
        });
      }
    } finally {
      this.syncing.delete(id);
    }
  }

  /** Báo chuông người phụ trách TKQC + Admin/Quản lý; lỗi gửi không làm hỏng đồng bộ. */
  private async notifyLowBalance(
    account: { id: string; name: string; ownerId: string },
    remaining: number,
    level: number,
  ): Promise<void> {
    try {
      const managers = await this.prisma.account.findMany({
        where: { role: { in: ['admin', 'manager'] }, status: 'active' },
        select: { id: true },
      });
      const ids = [...new Set([account.ownerId, ...managers.map((m) => m.id)])];
      const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
      const content =
        `TKQC "${account.name}" còn ${fmt(remaining)}đ giới hạn chi tiêu (dưới mốc ${fmt(level)}đ)`.slice(
          0,
          500,
        );
      const now = new Date();
      for (const accountId of ids) {
        const notification = await this.prisma.notification.create({
          data: {
            accountId,
            type: 'ad_balance_low',
            channel: 'in_app',
            content,
            scheduledAt: now,
            sentAt: now,
            status: 'sent',
            meta: { link: '/marketing-hub', ad_account_id: account.id },
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
      this.logger.error('Gửi cảnh báo số dư TKQC thất bại', error as Error);
    }
  }

  /** Tự đồng bộ mỗi 30 phút. */
  @Cron('*/30 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async syncAll(): Promise<void> {
    const ids = await this.prisma.adAccount.findMany({
      where: { status: 'connected', encryptedToken: { not: null } },
      select: { id: true },
    });
    for (const { id } of ids) await this.syncById(id);
    try {
      await this.discoverNew();
    } catch (e) {
      this.logger.warn(`Quét tài khoản quảng cáo mới lỗi: ${String(e)}`);
    }
    await this.resolveUnknownAds();
  }

  /**
   * Tra camp cho các mã quảng cáo Pancake chưa biết bằng cách hỏi thẳng Facebook từng mã,
   * thử lần lượt các token TKQC đã lưu (2026-11-21 — lấy danh sách theo TKQC không đủ).
   * Mỗi lượt tối đa 200 mã; mã tra không được thì thử lại sau 1 ngày. Trả về số mã ra tên camp.
   */
  async resolveUnknownAds(retryFailedNow = false): Promise<number> {
    if (this.resolvingAds) return 0;
    this.resolvingAds = true;
    let resolved = 0;
    try {
      const pending = await this.prisma.$queryRaw<{ ad_id: string }[]>`
        SELECT DISTINCT pc.ad_id
          FROM pancake_conversations pc
          LEFT JOIN fb_ads fa ON fa.ad_id = pc.ad_id
         WHERE pc.ad_id IS NOT NULL
           AND (fa.ad_id IS NULL
                -- Chưa có tên nhóm quảng cáo: mã tra thành công trước đây (chưa lấy ad set) tra lại
                -- ngay; mã tra lỗi thì đợi 1 ngày.
                OR (fa.adset_name IS NULL
                    AND (fa.last_error IS NULL OR ${retryFailedNow}::boolean
                         OR fa.updated_at < (now() AT TIME ZONE 'UTC') - interval '1 day')))
         LIMIT 200`;
      if (pending.length === 0) return 0;
      const accounts = await this.prisma.adAccount.findMany({
        where: { status: 'connected', encryptedToken: { not: null } },
        select: { id: true, externalId: true, encryptedToken: true },
      });
      const key = this.tokenKey();
      const tokens = [
        ...new Set(accounts.map((a) => decryptToken(a.encryptedToken!, key))),
      ];
      if (tokens.length === 0) return 0;
      const accountIdByExternal = new Map(
        accounts.map((a) => [a.externalId, a.id]),
      );
      const badTokens = new Set<string>();
      for (const { ad_id: adId } of pending) {
        let info: Awaited<ReturnType<typeof fetchAdInfo>> | null = null;
        let lastError = 'Không token nào đọc được quảng cáo này';
        for (const token of tokens) {
          if (badTokens.has(token)) continue;
          try {
            info = await fetchAdInfo(token, adId);
            break;
          } catch (e) {
            if (e instanceof FacebookApiError) {
              if (e.isTokenInvalid) badTokens.add(token);
              lastError = e.message;
            } else {
              lastError = 'Lỗi kết nối Facebook';
            }
          }
        }
        const data = info
          ? {
              adAccountId:
                (info.accountId && accountIdByExternal.get(info.accountId)) ??
                null,
              campaignId: info.campaignId?.slice(0, 64) ?? null,
              campaignName: info.campaignName?.slice(0, 255) ?? null,
              adsetId: info.adsetId?.slice(0, 64) ?? null,
              adsetName: info.adsetName?.slice(0, 255) ?? null,
              lastError: null,
            }
          : { lastError: lastError.slice(0, 255) };
        await this.prisma.fbAd.upsert({
          where: { adId },
          create: { adId, ...data },
          update: data,
        });
        if (info?.adsetName) resolved++;
      }
      this.logger.log(
        `Tra camp quảng cáo: ${resolved}/${pending.length} mã ra tên nhóm quảng cáo`,
      );
    } catch (e) {
      this.logger.warn(
        `Tra camp quảng cáo lỗi: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.resolvingAds = false;
    }
    return resolved;
  }

  /** Nút Làm mới của bảng Data theo ad set: tra lại ngay mọi mã chưa có tên ad set (kể cả mã từng lỗi). */
  async refreshAdsets(): Promise<{ resolved: number }> {
    return { resolved: await this.resolveUnknownAds(true) };
  }

  /**
   * Quét lại các token đã lưu, thêm tài khoản VNĐ mới mà token đó truy cập được (người phụ trách = chủ token).
   * Không đụng tài khoản đã có (kể cả đã gỡ liên kết). user trống = chạy tự động, quét mọi token.
   */
  async discoverNew(user?: AuthenticatedUser) {
    const key = this.tokenKey();
    const rows = await this.prisma.adAccount.findMany({
      where: {
        encryptedToken: { not: null },
        status: { not: 'disconnected' },
        ...(user && !can(user, 'mkt.assign_owner') ? { ownerId: user.id } : {}),
      },
      select: { encryptedToken: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
    });
    // Mỗi token chỉ gọi Facebook 1 lần (cùng token được mã hoá khác nhau ở mỗi dòng).
    const tokens = new Map<string, { encrypted: string; ownerId: string }>();
    for (const r of rows) {
      try {
        const plain = decryptToken(r.encryptedToken!, key);
        if (!tokens.has(plain))
          tokens.set(plain, {
            encrypted: r.encryptedToken!,
            ownerId: r.ownerId,
          });
      } catch {
        /* token hỏng → bỏ qua */
      }
    }
    const added: string[] = [];
    let failedTokens = 0;
    for (const [plain, { encrypted, ownerId }] of tokens) {
      let found: FbAdAccount[];
      try {
        found = await listAdAccounts(plain);
      } catch {
        failedTokens++;
        continue;
      }
      for (const fb of found) {
        if (fb.currency !== 'VND') continue;
        const exists = await this.prisma.adAccount.findUnique({
          where: {
            platform_externalId: {
              platform: 'facebook',
              externalId: fb.externalId,
            },
          },
          select: { id: true },
        });
        if (exists) continue;
        try {
          const row = await this.prisma.adAccount.create({
            data: {
              platform: 'facebook',
              externalId: fb.externalId,
              name: fb.name,
              currency: fb.currency,
              ownerId,
              encryptedToken: encrypted,
            },
          });
          await this.audit.log({
            accountId: user?.id ?? ownerId,
            actionType: 'create',
            entityType: 'ad_account',
            entityId: row.id,
            fieldChanged: 'discover',
            oldValue: undefined,
            newValue: fb.name,
          });
          added.push(fb.name);
          await this.syncById(row.id);
        } catch (e) {
          if ((e as { code?: string }).code !== 'P2002') throw e;
        }
      }
    }
    return { added, failedTokens };
  }

  async disconnect(id: string, user: AuthenticatedUser) {
    const account = await this.prisma.adAccount.findUnique({ where: { id } });
    if (!account)
      throw new NotFoundException('Không tìm thấy tài khoản quảng cáo');
    this.assertCanManage(account, user);
    await this.prisma.adAccount.update({
      where: { id },
      data: { encryptedToken: null, status: 'disconnected' },
    });
    await this.audit.log({
      accountId: user.id,
      actionType: 'delete',
      entityType: 'ad_account',
      entityId: id,
      fieldChanged: 'disconnect',
      oldValue: account.name,
      newValue: undefined,
    });
    return { ok: true };
  }

  listMktSources() {
    return this.prisma.mktSource.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Lưu cả danh sách Nguồn MKT (chỉ Admin — chặn ở controller). */
  async saveMktSources(
    items: { id?: string; name: string }[],
    user: AuthenticatedUser,
  ) {
    const cleaned = items
      .map((i) => ({ id: i.id, name: i.name.trim() }))
      .filter((i) => i.name);
    const names = cleaned.map((i) => i.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      throw new BadRequestException('Có nguồn MKT bị trùng tên');
    }
    const existing = await this.prisma.mktSource.findMany();
    const existingIds = new Set(existing.map((s) => s.id));
    const keepIds = new Set(
      cleaned.filter((i) => i.id && existingIds.has(i.id)).map((i) => i.id!),
    );
    const removed = existing.filter((s) => !keepIds.has(s.id));

    await this.prisma.$transaction(async (tx) => {
      if (removed.length > 0) {
        await tx.mktSource.deleteMany({
          where: { id: { in: removed.map((s) => s.id) } },
        });
      }
      // Đổi tên qua tên tạm trước để tránh vướng unique khi hoán đổi tên.
      const renames = cleaned.filter((i) => i.id && keepIds.has(i.id));
      for (const r of renames) {
        await tx.mktSource.update({
          where: { id: r.id },
          data: { name: `__tmp_${r.id}` },
        });
      }
      for (const r of renames) {
        await tx.mktSource.update({
          where: { id: r.id },
          data: { name: r.name },
        });
      }
      const created = cleaned.filter((i) => !i.id || !keepIds.has(i.id));
      if (created.length > 0) {
        await tx.mktSource.createMany({
          data: created.map((c) => ({ name: c.name })),
        });
      }
    });

    await this.audit.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'mkt_source',
      entityId: user.id,
      fieldChanged: 'list',
      oldValue: existing.map((s) => s.name).join(', '),
      newValue: cleaned.map((c) => c.name).join(', '),
    });
    return this.listMktSources();
  }

  async changeOwner(id: string, ownerId: string, user: AuthenticatedUser) {
    if (!can(user, 'mkt.assign_owner'))
      throw new ForbiddenException(
        'Bạn không có quyền đổi nhân viên phụ trách',
      );
    const [account, owner] = await Promise.all([
      this.prisma.adAccount.findUnique({ where: { id } }),
      this.prisma.account.findUnique({ where: { id: ownerId } }),
    ]);
    if (!account)
      throw new NotFoundException('Không tìm thấy tài khoản quảng cáo');
    if (
      !owner ||
      owner.status !== 'active' ||
      !['mkt', 'admin', 'manager'].includes(owner.role)
    ) {
      throw new BadRequestException(
        'Nhân viên phụ trách phải là Admin, Quản lý hoặc MKT đang hoạt động',
      );
    }
    await this.prisma.adAccount.update({ where: { id }, data: { ownerId } });
    await this.audit.log({
      accountId: user.id,
      actionType: 'assign',
      entityType: 'ad_account',
      entityId: id,
      fieldChanged: 'owner_id',
      oldValue: account.ownerId,
      newValue: ownerId,
    });
    return { ok: true };
  }

  /** Gắn/bỏ Nguồn MKT cho TKQC (chỉ Admin — chặn ở controller). Nhiều TKQC dùng chung 1 nguồn được. */
  async setMktSource(
    id: string,
    mktSourceId: string | null,
    user: AuthenticatedUser,
  ) {
    const account = await this.prisma.adAccount.findUnique({ where: { id } });
    if (!account)
      throw new NotFoundException('Không tìm thấy tài khoản quảng cáo');
    if (
      mktSourceId &&
      !(await this.prisma.mktSource.findUnique({ where: { id: mktSourceId } }))
    ) {
      throw new BadRequestException('Nguồn MKT không tồn tại');
    }
    await this.prisma.adAccount.update({
      where: { id },
      data: { mktSourceId },
    });
    await this.audit.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'ad_account',
      entityId: id,
      fieldChanged: 'mkt_source_id',
      oldValue: account.mktSourceId ?? undefined,
      newValue: mktSourceId ?? undefined,
    });
    return { ok: true };
  }

  /**
   * Khối Marketing trên Dashboard (hôm nay, giờ VN, không theo bộ lọc Dashboard):
   * chi phí + data hôm nay (data = lead có Nguồn MKT đã gắn TKQC, như dòng Toàn công ty);
   * CP/phỏng vấn = chi tiêu HÔM QUA ÷ số người trong danh sách đưa đón HÔM NAY.
   */
  /**
   * Khối Chi phí Marketing trên Dashboard theo khoảng [from, to] (ngày VN,
   * 2026-11-06; trống cả 2 = hôm nay; trống from = từ đầu). Chi phí/phỏng vấn
   * giữ quy tắc lệch 1 ngày: chi tiêu [from-1, to-1] ÷ người đưa đón [from, to].
   */
  async today(query: MarketingPeriodQueryDto = {}) {
    const hasRange = Boolean(query.from || query.to);
    const to = query.to ?? vnToday();
    const from = hasRange ? query.from : to;
    const shift = (d: string) =>
      new Date(new Date(`${d}T00:00:00.000Z`).getTime() - DAY_MS)
        .toISOString()
        .slice(0, 10);
    const spendBetween = async (a: string | undefined, b: string) =>
      Number(
        (
          await this.prisma.adSpendDaily.aggregate({
            where: {
              date: { ...(a ? { gte: new Date(a) } : {}), lte: new Date(b) },
            },
            _sum: { spend: true },
          })
        )._sum.spend ?? 0,
      );
    const [spend, yesterdaySpend, dataCount, interviewCount] =
      await Promise.all([
        spendBetween(from, to),
        spendBetween(from ? shift(from) : undefined, shift(to)),
        // Data thu được = MỌI số up trong kỳ (yêu cầu người dùng 2026-11-08 — data cũ tải lên
        // không có Nguồn MKT vẫn phải được đếm); trước đây chỉ đếm số có Nguồn MKT đã gắn TKQC.
        this.prisma.lead.count({
          where: {
            deletedAt: null,
            uploadedAt: {
              ...(from ? { gte: vnDayRange(from).start } : {}),
              lt: vnDayRange(to).end,
            },
          },
        }),
        // Số người phỏng vấn = dòng đưa đón trong kỳ, gộp trùng SĐT + tên (2026-11-08).
        this.prisma.shuttleRecord
          .findMany({
            where: {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                lte: new Date(to),
              },
              deletedAt: null,
            },
            select: { phoneNumber: true, fullName: true },
          })
          .then(countShuttlePersons),
      ]);
    return {
      date: to,
      from: from ?? null,
      to,
      spend,
      data_count: dataCount,
      cost_per_data: dataCount > 0 ? spend / dataCount : null,
      yesterday_spend: yesterdaySpend,
      interview_count: interviewCount,
      cost_per_interview:
        interviewCount > 0 ? yesterdaySpend / interviewCount : null,
    };
  }

  async getCostThresholds() {
    const row = await this.prisma.mktCostThreshold.findFirst();
    return row ? { green_max: row.greenMax, red_min: row.redMin } : null;
  }

  /** Lưu ngưỡng giá số (chỉ Admin — chặn ở controller). */
  async saveCostThresholds(
    greenMax: number,
    redMin: number,
    user: AuthenticatedUser,
  ) {
    if (greenMax >= redMin) {
      throw new BadRequestException('Mốc xanh phải nhỏ hơn mốc đỏ');
    }
    const existing = await this.prisma.mktCostThreshold.findFirst();
    if (existing) {
      await this.prisma.mktCostThreshold.update({
        where: { id: existing.id },
        data: { greenMax, redMin },
      });
    } else {
      await this.prisma.mktCostThreshold.create({ data: { greenMax, redMin } });
    }
    await this.audit.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'mkt_cost_threshold',
      entityId: user.id,
      fieldChanged: 'thresholds',
      oldValue: existing
        ? `${existing.greenMax}/${existing.redMin}`
        : undefined,
      newValue: `${greenMax}/${redMin}`,
    });
    return this.getCostThresholds();
  }

  /** Tổng quan: bảng tài khoản (không có token) + tổng chi tiêu + số data chung toàn công ty trong kỳ. */
  async overview(q: OverviewQueryDto) {
    const to = q.to ?? vnToday();
    const from = q.from ?? vnDaysAgo(29);
    if (from > to)
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    const accountWhere = {
      ...(q.platform ? { platform: q.platform } : {}),
      ...(q.ad_account_id ? { id: q.ad_account_id } : {}),
      ...(q.owner_id ? { ownerId: q.owner_id } : {}),
    };
    const accounts = await this.prisma.adAccount.findMany({
      where: accountWhere,
      include: {
        owner: { select: { id: true, fullName: true } },
        mktSource: { select: { id: true, name: true } },
      },
      orderBy: [{ owner: { fullName: 'asc' } }, { name: 'asc' }],
    });
    const uploadedInRange = {
      gte: vnDayRange(from).start,
      lt: vnDayRange(to).end,
    };
    // Số data = số lead (chưa xoá) up trong kỳ có chọn Nguồn MKT gắn với TKQC. Data không tách theo
    // TKQC nên chỉ tính theo nhân viên (các nguồn khác nhau của các TKQC người đó) và toàn công ty.
    const sourceIds = [
      ...new Set(
        accounts.map((a) => a.mktSourceId).filter((id): id is string => !!id),
      ),
    ];
    // Các truy vấn độc lập chạy song song (trước đây chạy lần lượt).
    const countDataBySource = async (): Promise<[string | null, number][]> => {
      if (!sourceIds.length) return [];
      const rows = await this.prisma.lead.groupBy({
        by: ['mktSourceId'],
        where: {
          deletedAt: null,
          mktSourceId: { in: sourceIds },
          uploadedAt: uploadedInRange,
        },
        _count: { _all: true },
      });
      return rows.map((d) => [d.mktSourceId, d._count._all]);
    };
    const [dataPairs, spends, leadTotal, costThresholds] = await Promise.all([
      countDataBySource(),
      this.prisma.adSpendDaily.groupBy({
        by: ['adAccountId'],
        where: {
          adAccountId: { in: accounts.map((a) => a.id) },
          date: { gte: new Date(from), lte: new Date(to) },
        },
        _sum: { spend: true },
      }),
      this.prisma.lead.count({
        where: { deletedAt: null, uploadedAt: uploadedInRange },
      }),
      this.getCostThresholds(),
    ]);
    const dataBySource = new Map(dataPairs);
    const sumSources = (ids: Set<string>) =>
      [...ids].reduce((s, id) => s + (dataBySource.get(id) ?? 0), 0);
    const sourcesByOwner = new Map<string, Set<string>>();
    for (const a of accounts) {
      if (!a.mktSourceId) continue;
      const set = sourcesByOwner.get(a.ownerId) ?? new Set<string>();
      set.add(a.mktSourceId);
      sourcesByOwner.set(a.ownerId, set);
    }
    const dataByOwner = Object.fromEntries(
      [...sourcesByOwner].map(([ownerId, ids]) => [ownerId, sumSources(ids)]),
    );
    const spendById = new Map(
      spends.map((s) => [s.adAccountId, Number(s._sum.spend ?? 0)]),
    );
    const items = accounts.map((a) => ({
      id: a.id,
      owner: { id: a.owner.id, full_name: a.owner.fullName },
      name: a.name,
      platform: a.platform,
      total_spend: spendById.get(a.id) ?? 0,
      status: a.status,
      // Chưa đồng bộ lần nào ⇒ chưa có số liệu thật, UI hiển thị "—".
      synced: a.lastSyncAt !== null,
      last_sync_at: a.lastSyncAt?.toISOString() ?? null,
      last_error: a.lastError,
      mkt_source: a.mktSource,
      account_health: accountHealth(a.fbAccountStatus),
      has_active_campaign: a.hasActiveCampaign,
      /** Số dư còn lại của giới hạn chi tiêu; null = không đặt giới hạn / chưa đồng bộ. */
      balance: balanceOf(a.spendCap, a.amountSpent),
    }));
    return {
      from,
      to,
      cost_thresholds: costThresholds,
      /** Số data theo nhân viên phụ trách (chỉ người có TKQC đã gắn nguồn) và toàn công ty. */
      data_by_owner: dataByOwner,
      data_total: sumSources(new Set(sourceIds)),
      total_spend: items.reduce((s, i) => s + i.total_spend, 0),
      has_synced_data: items.some((i) => i.synced),
      lead_total: leadTotal,
      items,
    };
  }

  /**
   * Bảng "Data theo ad set" (2026-11-21): MỌI data up trong kỳ (theo ngày up); data Pancake từ quảng cáo,
   * theo nhân viên + ad set (Nhân viên = người phụ trách TKQC; chưa tra được thì người up);
   * data còn lại (không qua quảng cáo) gộp 1 dòng mỗi người up.
   */
  async campaignData(q: MarketingPeriodQueryDto & { owner_id?: string }) {
    const to = q.to ?? vnToday();
    const from = q.from ?? vnDaysAgo(29);
    if (from > to)
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    const start = vnDayRange(from).start;
    const end = vnDayRange(to).end;
    const rows = await this.prisma.$queryRaw<
      {
        owner_id: string;
        owner_name: string;
        no_ad: boolean;
        adset_id: string | null;
        adset_name: string | null;
        total: number;
        red: number;
        yellow: number;
        green: number;
        closed: number;
      }[]
    >`
      SELECT o.id AS owner_id, o.full_name AS owner_name,
             (pc.ad_id IS NULL) AS no_ad, fa.adset_id, MAX(fa.adset_name) AS adset_name,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE l.note_color = 'red')::int AS red,
             COUNT(*) FILTER (WHERE l.note_color = 'yellow')::int AS yellow,
             COUNT(*) FILTER (WHERE l.note_color = 'green')::int AS green,
             COUNT(*) FILTER (WHERE l.care_stopped_at IS NOT NULL)::int AS closed
        FROM leads l
        -- Mọi data trong kỳ (2026-11-21: thêm dòng nhập tay để đủ số): data có mã quảng cáo
        -- theo ad set; còn lại (nhập tay/Excel/website/khách tự nhắn page) gộp 1 dòng/người up.
        LEFT JOIN LATERAL (
          SELECT ad_id FROM pancake_conversations
           WHERE lead_id = l.id AND ad_id IS NOT NULL
           LIMIT 1
        ) pc ON true
        LEFT JOIN fb_ads fa ON fa.ad_id = pc.ad_id
        LEFT JOIN ad_accounts aa ON aa.id = fa.ad_account_id
        JOIN accounts o ON o.id = COALESCE(aa.owner_id, l.uploaded_by)
       WHERE l.deleted_at IS NULL
         -- Cột lưu giờ UTC không múi giờ: đổi tham số về UTC, không phụ thuộc múi giờ phiên DB.
         AND l.uploaded_at >= (${start}::timestamptz AT TIME ZONE 'UTC')
         AND l.uploaded_at < (${end}::timestamptz AT TIME ZONE 'UTC')
       GROUP BY o.id, o.full_name, (pc.ad_id IS NULL), fa.adset_id
       ORDER BY o.full_name, (pc.ad_id IS NULL), total DESC`;
    const items = rows
      .filter((r) => !q.owner_id || r.owner_id === q.owner_id)
      .map((r) => ({
        owner: { id: r.owner_id, full_name: r.owner_name },
        /** true = dòng data không qua quảng cáo (nhập tay/Excel/website/tự nhắn page). */
        no_ad: r.no_ad,
        adset_id: r.adset_id,
        adset_name: r.adset_name,
        total: r.total,
        red: r.red,
        yellow: r.yellow,
        green: r.green,
        closed: r.closed,
      }));
    return { from, to, items };
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { vnDayRange } from '../care-warehouse/care-time.util';
import { decryptToken, encryptToken } from './token-crypto';
import {
  FacebookApiError,
  FbAdAccount,
  fetchAccountHealth,
  fetchDailySpend,
  listAdAccounts,
} from './facebook-ads.client';
import { OverviewQueryDto } from './dto/marketing-hub.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_SYNC_DAYS = 30;
const RESYNC_DAYS = 3; // Meta có thể điều chỉnh số liệu những ngày gần nhất
const vnToday = () =>
  new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const vnDaysAgo = (n: number) =>
  new Date(Date.now() + 7 * 3600_000 - n * DAY_MS).toISOString().slice(0, 10);

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
export class MarketingHubService {
  private readonly logger = new Logger(MarketingHubService.name);
  /** Khoá trong bộ nhớ: không đồng bộ 2 lần cùng lúc 1 tài khoản (backend chạy 1 bản). */
  private readonly syncing = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
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

  private assertCanManage(
    account: { ownerId: string },
    user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && account.ownerId !== user.id) {
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
      if (existing && existing.ownerId !== user.id && user.role !== 'admin') {
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
          },
        });
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

  /** Tự đồng bộ mỗi 30 phút. */
  @Cron('*/30 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async syncAll(): Promise<void> {
    const ids = await this.prisma.adAccount.findMany({
      where: { status: 'connected', encryptedToken: { not: null } },
      select: { id: true },
    });
    for (const { id } of ids) await this.syncById(id);
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
    if (user.role !== 'admin')
      throw new ForbiddenException('Chỉ Admin được đổi nhân viên phụ trách');
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
    const dataCounts = sourceIds.length
      ? await this.prisma.lead.groupBy({
          by: ['mktSourceId'],
          where: {
            deletedAt: null,
            mktSourceId: { in: sourceIds },
            uploadedAt: uploadedInRange,
          },
          _count: { _all: true },
        })
      : [];
    const dataBySource = new Map(
      dataCounts.map((d) => [d.mktSourceId, d._count._all]),
    );
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
    const spends = await this.prisma.adSpendDaily.groupBy({
      by: ['adAccountId'],
      where: {
        adAccountId: { in: accounts.map((a) => a.id) },
        date: { gte: new Date(from), lte: new Date(to) },
      },
      _sum: { spend: true },
    });
    const spendById = new Map(
      spends.map((s) => [s.adAccountId, Number(s._sum.spend ?? 0)]),
    );
    const leadTotal = await this.prisma.lead.count({
      where: {
        deletedAt: null,
        uploadedAt: uploadedInRange,
      },
    });
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
    }));
    return {
      from,
      to,
      cost_thresholds: await this.getCostThresholds(),
      /** Số data theo nhân viên phụ trách (chỉ người có TKQC đã gắn nguồn) và toàn công ty. */
      data_by_owner: dataByOwner,
      data_total: sumSources(new Set(sourceIds)),
      total_spend: items.reduce((s, i) => s + i.total_spend, 0),
      has_synced_data: items.some((i) => i.synced),
      lead_total: leadTotal,
      items,
    };
  }
}

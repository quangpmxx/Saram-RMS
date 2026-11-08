import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MarketingHubService } from './marketing-hub.service';
import { decryptToken, encryptToken } from './token-crypto';
import * as fb from './facebook-ads.client';

const KEY = 'k'.repeat(40);
const mkt = { id: 'u1', role: 'mkt', sessionId: 's' } as never;
const other = { id: 'u2', role: 'mkt', sessionId: 's' } as never;
const admin = { id: 'a1', role: 'admin', sessionId: 's' } as never;

function build(prisma: Record<string, unknown>) {
  const config = {
    get: (k: string) => (k === 'MARKETING_TOKEN_KEY' ? KEY : undefined),
  };
  const audit = { log: jest.fn() };
  return new MarketingHubService(
    prisma as never,
    config as never,
    audit as never,
  );
}

describe('token-crypto', () => {
  it('mã hoá rồi giải mã ra đúng token, bản mã không chứa token', () => {
    const enc = encryptToken('EAAB-secret-token-123456', KEY);
    expect(enc).not.toContain('secret');
    expect(decryptToken(enc, KEY)).toBe('EAAB-secret-token-123456');
  });
  it('sai khoá thì không giải mã được', () => {
    expect(() =>
      decryptToken(encryptToken('x'.repeat(30), KEY), 'z'.repeat(40)),
    ).toThrow();
  });
});

describe('MarketingHubService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('connect: bỏ qua tài khoản không phải VNĐ và tài khoản của người khác', async () => {
    jest.spyOn(fb, 'listAdAccounts').mockResolvedValue([
      { externalId: '1', name: 'USD acc', currency: 'USD' },
      { externalId: '2', name: 'Của người khác', currency: 'VND' },
      { externalId: '3', name: 'Mới', currency: 'VND' },
    ]);
    const prisma = {
      adAccount: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(
            where.platform_externalId.externalId === '2'
              ? { id: 'x', ownerId: 'u2' }
              : where.id
                ? null
                : null,
          ),
        ),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
      },
    };
    const svc = build(prisma);
    jest.spyOn(svc, 'syncById').mockResolvedValue();
    const res = await svc.connect('t'.repeat(30), mkt);
    expect(res.connected).toBe(1);
    expect(res.skipped.map((s) => s.name)).toEqual([
      'USD acc',
      'Của người khác',
    ]);
    // token lưu mã hoá, không lưu nguyên văn
    expect(
      prisma.adAccount.create.mock.calls[0][0].data.encryptedToken,
    ).not.toContain('ttttt');
  });

  it('MKT không được đồng bộ/gỡ tài khoản của người khác; Admin được', async () => {
    const prisma = {
      adAccount: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'x', ownerId: 'u1', encryptedToken: 'e' }),
        update: jest.fn(),
      },
    };
    const svc = build(prisma);
    await expect(svc.syncNow('x', other)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.disconnect('x', other)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.disconnect('x', admin)).resolves.toEqual({ ok: true });
  });

  it('chỉ Admin đổi người phụ trách', async () => {
    await expect(build({}).changeOwner('x', 'u2', mkt)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('syncNow báo xung đột khi đang đồng bộ', async () => {
    const prisma = {
      adAccount: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'x', ownerId: 'u1', encryptedToken: 'e' }),
      },
    };
    const svc = build(prisma);
    (svc as unknown as { syncing: Set<string> }).syncing.add('x');
    await expect(svc.syncNow('x', mkt)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('syncById: lỗi token (190) → status error, ghi last_error, không ném lỗi', async () => {
    const enc = encryptToken('t'.repeat(30), KEY);
    const update = jest.fn();
    const prisma = {
      adAccount: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'x',
          externalId: '9',
          encryptedToken: enc,
          lastSyncAt: null,
          status: 'connected',
        }),
        update,
      },
    };
    jest
      .spyOn(fb, 'fetchDailySpend')
      .mockRejectedValue(new fb.FacebookApiError('Token expired', 190));
    await build(prisma).syncById('x');
    expect(update.mock.calls[0][0].data).toMatchObject({
      status: 'error',
      lastError: 'Token expired',
    });
  });

  it('overview: tài khoản chưa đồng bộ → synced=false, chi tiêu 0, không tự điền số', async () => {
    const prisma = {
      adAccount: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'x',
            name: 'A',
            platform: 'facebook',
            status: 'connected',
            lastSyncAt: null,
            lastError: null,
            owner: { id: 'u1', fullName: 'N' },
          },
        ]),
      },
      adSpendDaily: { groupBy: jest.fn().mockResolvedValue([]) },
      lead: { count: jest.fn().mockResolvedValue(7) },
      mktCostThreshold: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const r = await build(prisma).overview({
      from: '2026-11-01',
      to: '2026-11-02',
    });
    expect(r).toMatchObject({
      total_spend: 0,
      has_synced_data: false,
      lead_total: 7,
    });
    expect(r.items[0]).toMatchObject({ synced: false, total_spend: 0 });
    expect(r).toMatchObject({ data_by_owner: {}, data_total: 0 });
    expect(JSON.stringify(r)).not.toContain('encrypted');
  });

  it('overview: số data theo nhân viên (nguồn dùng chung không đếm 2 lần), trạng thái TK theo account_status', async () => {
    const base = {
      platform: 'facebook',
      status: 'connected',
      lastSyncAt: new Date(),
      lastError: null,
      ownerId: 'u1',
      owner: { id: 'u1', fullName: 'N' },
      hasActiveCampaign: true,
    };
    const groupBy = jest.fn().mockResolvedValue([
      { mktSourceId: 's1', _count: { _all: 4 } },
      { mktSourceId: 's2', _count: { _all: 3 } },
    ]);
    const prisma = {
      adAccount: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...base,
            id: 'a',
            name: 'A',
            mktSourceId: 's1',
            mktSource: { id: 's1', name: 'P1' },
            fbAccountStatus: 1,
          },
          {
            ...base,
            id: 'b',
            name: 'B',
            mktSourceId: 's1',
            mktSource: { id: 's1', name: 'P1' },
            fbAccountStatus: 3,
          },
          {
            ...base,
            id: 'c',
            name: 'C',
            mktSourceId: 's2',
            ownerId: 'u2',
            owner: { id: 'u2', fullName: 'M' },
            mktSource: { id: 's2', name: 'P2' },
            fbAccountStatus: 2,
          },
        ]),
      },
      adSpendDaily: { groupBy: jest.fn().mockResolvedValue([]) },
      lead: { count: jest.fn().mockResolvedValue(0), groupBy },
      mktCostThreshold: {
        findFirst: jest.fn().mockResolvedValue({ greenMax: 10, redMin: 20 }),
      },
    };
    const r = await build(prisma).overview({
      from: '2026-11-01',
      to: '2026-11-02',
    });
    expect(groupBy.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      mktSourceId: { in: ['s1', 's2'] },
    });
    expect(r.items.map((i) => i.account_health)).toEqual([
      'live',
      'unpaid',
      'die',
    ]);
    expect(r).toMatchObject({ data_by_owner: { u1: 4, u2: 3 }, data_total: 7 });
    expect(r.cost_thresholds).toEqual({ green_max: 10, red_min: 20 });
  });

  it('saveCostThresholds: mốc xanh phải nhỏ hơn mốc đỏ', async () => {
    await expect(build({}).saveCostThresholds(50, 50, admin)).rejects.toThrow(
      'Mốc xanh',
    );
  });
});

describe('MarketingHubService.today', () => {
  it('CP/phỏng vấn = chi tiêu hôm qua ÷ số đưa đón hôm nay; chi phí/data theo hôm nay', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { spend: 600000 } })
      .mockResolvedValueOnce({ _sum: { spend: 900000 } });
    const prisma = {
      adSpendDaily: { aggregate },
      adAccount: {
        findMany: jest.fn().mockResolvedValue([{ mktSourceId: 's1' }]),
      },
      lead: { count: jest.fn().mockResolvedValue(20) },
      shuttleRecord: { count: jest.fn().mockResolvedValue(3) },
    };
    const r = await build(prisma).today();
    expect(r).toMatchObject({
      spend: 600000,
      data_count: 20,
      cost_per_data: 30000,
      yesterday_spend: 900000,
      interview_count: 3,
      cost_per_interview: 300000,
    });
  });

  it('theo khoảng thời gian chung của Dashboard (2026-11-06): chi tiêu [from,to], CP/PV lệch 1 ngày', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { spend: 3000000 } })
      .mockResolvedValueOnce({ _sum: { spend: 2400000 } });
    const shuttleCount = jest.fn().mockResolvedValue(8);
    const prisma = {
      adSpendDaily: { aggregate },
      adAccount: {
        findMany: jest.fn().mockResolvedValue([{ mktSourceId: 's1' }]),
      },
      lead: { count: jest.fn().mockResolvedValue(100) },
      shuttleRecord: { count: shuttleCount },
    };
    const r = await build(prisma).today({
      from: '2026-11-01',
      to: '2026-11-06',
    });

    // Chi tiêu trong kỳ: 01→06; chi tiêu dùng cho CP/PV: 31/10→05.
    expect(aggregate.mock.calls[0][0].where.date).toEqual({
      gte: new Date('2026-11-01'),
      lte: new Date('2026-11-06'),
    });
    expect(aggregate.mock.calls[1][0].where.date).toEqual({
      gte: new Date('2026-10-31'),
      lte: new Date('2026-11-05'),
    });
    expect(shuttleCount.mock.calls[0][0].where.date).toEqual({
      gte: new Date('2026-11-01'),
      lte: new Date('2026-11-06'),
    });
    expect(r).toMatchObject({
      spend: 3000000,
      data_count: 100,
      cost_per_data: 30000,
      interview_count: 8,
      cost_per_interview: 300000,
    });
  });

  it('Data thu được đếm MỌI số up trong kỳ, không lọc Nguồn MKT (2026-11-08)', async () => {
    const leadCount = jest.fn().mockResolvedValue(5);
    const prisma = {
      adSpendDaily: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { spend: 0 } }),
      },
      lead: { count: leadCount },
      shuttleRecord: { count: jest.fn().mockResolvedValue(0) },
    };
    const r = await build(prisma).today({
      from: '2026-11-01',
      to: '2026-11-06',
    });
    expect(leadCount.mock.calls[0][0].where).not.toHaveProperty('mktSourceId');
    expect(r).toMatchObject({ data_count: 5 });
  });
});

import { LaborBonusService } from './labor-bonus.service';

describe('LaborBonusService (Kế toán › Thưởng lao động)', () => {
  const user = { id: 'acc-1', role: 'accounting', sessionId: 's' } as never;

  function build(targets: unknown[]) {
    const prisma = {
      salesEntryRecord: {
        findMany: jest.fn().mockResolvedValue(targets),
        updateMany: jest.fn().mockResolvedValue({ count: targets.length }),
      },
      notification: {
        create: jest.fn((a: { data: Record<string, unknown> }) => ({
          id: 'n',
          ...a.data,
          createdAt: new Date(),
          readAt: null,
          sender: null,
        })),
      },
    };
    const realtime = { emitNotificationCreated: jest.fn() };
    const auditLog = { log: jest.fn() };
    const service = new LaborBonusService(
      prisma as never,
      realtime as never,
      auditLog as never,
    );
    return { service, prisma, realtime };
  }

  it('tick đã chi: chỉ đụng dòng thưởng chưa chi, ghi người chi, báo gộp 1 lần / người nhập', async () => {
    const { service, prisma } = build([
      { id: 'r1', createdById: 'u1', amount: 500000 },
      { id: 'r2', createdById: 'u1', amount: 300000 },
      { id: 'r3', createdById: 'u2', amount: 200000 },
    ]);
    const res = await service.markPaid(
      { ids: ['r1', 'r2', 'r3'], paid_date: '2026-11-15' },
      user,
    );
    expect(res.updated).toBe(3);
    expect(prisma.salesEntryRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'bonus',
          paidDate: null,
          deletedAt: null,
        }),
      }),
    );
    expect(prisma.salesEntryRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { paidDate: new Date('2026-11-15'), paidById: 'acc-1' },
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    const first = prisma.notification.create.mock.calls[0][0].data;
    expect(first.accountId).toBe('u1');
    expect(first.type).toBe('labor_bonus_paid');
    expect(first.content).toContain('2 khoản');
  });

  it('không có dòng nào chưa chi → không ghi, không báo', async () => {
    const { service, prisma } = build([]);
    expect(await service.markPaid({ ids: ['r1'] }, user)).toEqual({
      updated: 0,
    });
    expect(prisma.salesEntryRecord.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('bỏ đánh dấu: xoá ngày chi + người chi của dòng đã chi', async () => {
    const { service, prisma } = build([{}]);
    await service.unmarkPaid(['r1'], user);
    expect(prisma.salesEntryRecord.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        kind: 'bonus',
        paidDate: { not: null },
      }),
      data: { paidDate: null, paidById: null },
    });
  });
});

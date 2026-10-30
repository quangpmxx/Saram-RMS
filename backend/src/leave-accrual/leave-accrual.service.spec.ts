import { Test } from '@nestjs/testing';
import { LeaveAccrualService } from './leave-accrual.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeaveAccrualService', () => {
  let service: LeaveAccrualService;
  let prisma: {
    account: { findMany: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };

  // 17:00 giờ VN (10:00 UTC) ngày 15/07/2026 — luôn nằm trong "tháng 7" ở cả
  // UTC lẫn Asia/Ho_Chi_Minh, tránh test bị lệch tháng do đổi timezone.
  const NOW = new Date('2026-07-15T10:00:00.000Z');

  /** Lần gọi updateMany "cộng +1" (khác lần chuẩn hoá null → 0). */
  const incrementCalls = () =>
    prisma.account.updateMany.mock.calls
      .map((c) => c[0] as { where: Record<string, unknown>; data: unknown })
      .filter(
        (arg) =>
          typeof arg.data === 'object' &&
          arg.data !== null &&
          'lastLeaveAccrualAt' in arg.data,
      );

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    prisma = {
      account: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      // Dạng mảng: chạy lần lượt các thao tác đã dựng sẵn, trả mảng kết quả.
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeaveAccrualService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(LeaveAccrualService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1) Nhân viên chưa từng được cộng (lastLeaveAccrualAt=null) -> được cộng +1 nguyên tử, số cũ null được chuẩn hoá về 0', async () => {
    prisma.account.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        fullName: 'Sale One',
        remainingLeaveDays: null,
        lastLeaveAccrualAt: null,
      },
    ]);

    const result = await service.runAccrual();

    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      where: { id: 'sale-1', remainingLeaveDays: null },
      data: { remainingLeaveDays: 0 },
    });
    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      where: { id: 'sale-1', lastLeaveAccrualAt: null },
      data: { remainingLeaveDays: { increment: 1 }, lastLeaveAccrualAt: NOW },
    });
    expect(result).toEqual({ checked: 1, accrued: ['Sale One'] });
  });

  it('2) Đã được cộng THÁNG TRƯỚC -> tháng này được cộng thêm +1 (tăng nguyên tử, không ghi đè số đã đọc)', async () => {
    const lastMonth = new Date('2026-06-15T10:00:00.000Z');
    prisma.account.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        fullName: 'Sale One',
        remainingLeaveDays: 3,
        lastLeaveAccrualAt: lastMonth,
      },
    ]);

    await service.runAccrual();

    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      where: { id: 'sale-1', lastLeaveAccrualAt: lastMonth },
      data: { remainingLeaveDays: { increment: 1 }, lastLeaveAccrualAt: NOW },
    });
  });

  it('3) Đã được cộng TRONG CHÍNH THÁNG NÀY rồi -> KHÔNG cộng lại (chặn double-accrual dù cron chạy lại/server khởi động lại)', async () => {
    prisma.account.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        fullName: 'Sale One',
        remainingLeaveDays: 4,
        lastLeaveAccrualAt: new Date('2026-07-02T10:00:00.000Z'),
      },
    ]);

    const result = await service.runAccrual();

    expect(prisma.account.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, accrued: [] });
  });

  it('4) Nhiều nhân viên: chỉ cộng đúng những người CHƯA được cộng tháng này', async () => {
    prisma.account.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        fullName: 'Chưa cộng',
        remainingLeaveDays: 0,
        lastLeaveAccrualAt: null,
      },
      {
        id: 'sale-2',
        fullName: 'Đã cộng tháng này',
        remainingLeaveDays: 5,
        lastLeaveAccrualAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.runAccrual();

    expect(incrementCalls()).toHaveLength(1);
    expect(incrementCalls()[0].where).toEqual({
      id: 'sale-1',
      lastLeaveAccrualAt: null,
    });
    expect(result).toEqual({ checked: 2, accrued: ['Chưa cộng'] });
  });

  it('5) Chỉ truy vấn account có role leader/mkt/sale + status active (đúng nhóm hiện trên bảng chấm công)', async () => {
    await service.runAccrual();

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { role: { in: ['leader', 'mkt', 'sale'] }, status: 'active' },
      select: expect.objectContaining({
        id: true,
        fullName: true,
        remainingLeaveDays: true,
        lastLeaveAccrualAt: true,
      }),
    });
  });

  it('6) H1: lần chạy khác đã cộng trước (lastLeaveAccrualAt đổi → không khớp điều kiện, count=0) -> KHÔNG cộng trùng và không có trong danh sách đã cộng', async () => {
    prisma.account.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        fullName: 'Đã bị chạy khác cộng',
        remainingLeaveDays: 2,
        lastLeaveAccrualAt: null,
      },
    ]);
    // Bước chuẩn hoá null → 0 không khớp (số đã là 2); bước cộng +1 không khớp
    // vì người khác đã cộng giữa lúc đọc và ghi.
    prisma.account.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.runAccrual();

    expect(result).toEqual({ checked: 1, accrued: [] });
  });

  it('7) H1: không bao giờ ghi đè remainingLeaveDays bằng giá trị đã đọc (chỉ dùng increment) để không đè cập nhật của chấm công', async () => {
    prisma.account.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        fullName: 'Sale One',
        remainingLeaveDays: 7,
        lastLeaveAccrualAt: null,
      },
    ]);

    await service.runAccrual();

    for (const call of incrementCalls()) {
      expect(call.data).toEqual({
        remainingLeaveDays: { increment: 1 },
        lastLeaveAccrualAt: NOW,
      });
    }
  });
});

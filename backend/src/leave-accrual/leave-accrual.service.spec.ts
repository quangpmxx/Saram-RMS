import { Test } from '@nestjs/testing';
import { LeaveAccrualService } from './leave-accrual.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeaveAccrualService', () => {
  let service: LeaveAccrualService;
  let prisma: {
    account: { findMany: jest.Mock; update: jest.Mock };
  };

  // 17:00 giờ VN (10:00 UTC) ngày 15/07/2026 — luôn nằm trong "tháng 7" ở cả
  // UTC lẫn Asia/Ho_Chi_Minh, tránh test bị lệch tháng do đổi timezone.
  const NOW = new Date('2026-07-15T10:00:00.000Z');

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    prisma = {
      account: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
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

  it('1) Nhân viên chưa từng được cộng (lastLeaveAccrualAt=null) -> được cộng +1, coi số cũ null là 0', async () => {
    prisma.account.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        fullName: 'Sale One',
        remainingLeaveDays: null,
        lastLeaveAccrualAt: null,
      },
    ]);

    const result = await service.runAccrual();

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { remainingLeaveDays: 1, lastLeaveAccrualAt: NOW },
    });
    expect(result).toEqual({ checked: 1, accrued: ['Sale One'] });
  });

  it('2) Đã được cộng THÁNG TRƯỚC -> tháng này được cộng thêm +1 (cộng dồn đúng vào số hiện có)', async () => {
    prisma.account.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        fullName: 'Sale One',
        remainingLeaveDays: 3,
        lastLeaveAccrualAt: new Date('2026-06-15T10:00:00.000Z'),
      },
    ]);

    await service.runAccrual();

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { remainingLeaveDays: 4, lastLeaveAccrualAt: NOW },
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

    expect(prisma.account.update).not.toHaveBeenCalled();
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

    expect(prisma.account.update).toHaveBeenCalledTimes(1);
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { remainingLeaveDays: 1, lastLeaveAccrualAt: NOW },
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
});

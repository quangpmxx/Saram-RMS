import { Test } from '@nestjs/testing';
import {
  SaleReminderService,
  SALE_NO_SHUTTLE_MESSAGE,
} from './sale-reminder.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

describe('SaleReminderService', () => {
  let service: SaleReminderService;
  let prisma: {
    account: { findMany: jest.Mock; findUnique: jest.Mock };
    shuttleRecord: {
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    notification: {
      findFirst: jest.Mock;
      createMany: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const NOW = new Date('2026-07-13T10:00:00.000Z'); // 17:00 giờ VN — luôn nằm trong "ngày 13/07" ở cả UTC lẫn Asia/Ho_Chi_Minh, tránh test bị lệch ngày do đổi timezone.
  const daysAgo = (n: number) =>
    new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    prisma = {
      account: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      shuttleRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const realtimeService = { emitNotificationCreated: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SaleReminderService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    service = moduleRef.get(SaleReminderService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sale = {
    id: 'sale-1',
    fullName: 'Sale Demo Test',
    role: 'sale',
    status: 'active',
    createdAt: daysAgo(30),
    team: null,
  };

  it('Sale chưa từng có bản ghi, tài khoản tạo hơn 3 ngày — vi phạm, tạo thông báo cho chính Sale', async () => {
    prisma.account.findMany.mockResolvedValue([sale]);
    prisma.shuttleRecord.findFirst.mockResolvedValue(null);

    const result = await service.runCheck();

    expect(result.violated).toEqual(['Sale Demo Test']);
    expect(result.notified).toBe(1);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          accountId: 'sale-1',
          type: 'sale_no_shuttle_reminder',
          channel: 'in_app',
          content: SALE_NO_SHUTTLE_MESSAGE,
          status: 'sent',
        }),
      ],
    });
  });

  it('Sale có bản ghi trong 3 ngày gần nhất — KHÔNG vi phạm, không tạo thông báo', async () => {
    prisma.account.findMany.mockResolvedValue([sale]);
    prisma.shuttleRecord.findFirst.mockResolvedValue({ date: daysAgo(2) });

    const result = await service.runCheck();

    expect(result.violated).toEqual([]);
    expect(result.notified).toBe(0);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('Sale có bản ghi đúng 3 ngày trước — chưa sang ngày thứ 4, KHÔNG vi phạm', async () => {
    prisma.account.findMany.mockResolvedValue([sale]);
    prisma.shuttleRecord.findFirst.mockResolvedValue({ date: daysAgo(3) });

    const result = await service.runCheck();

    expect(result.violated).toEqual([]);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('Sale có bản ghi 4 ngày trước — sang ngày thứ 4, vi phạm, tạo thông báo', async () => {
    prisma.account.findMany.mockResolvedValue([sale]);
    prisma.shuttleRecord.findFirst.mockResolvedValue({ date: daysAgo(4) });

    const result = await service.runCheck();

    expect(result.violated).toEqual(['Sale Demo Test']);
    expect(result.notified).toBe(1);
  });

  it('Đã gửi thông báo trong cùng chu kỳ vi phạm (sau mốc bản ghi cuối) — KHÔNG gửi trùng', async () => {
    prisma.account.findMany.mockResolvedValue([sale]);
    const lastRecordDate = daysAgo(6);
    prisma.shuttleRecord.findFirst.mockResolvedValue({ date: lastRecordDate });
    prisma.notification.findFirst.mockResolvedValue({
      id: 'notif-1',
      createdAt: daysAgo(1), // đã gửi sau mốc bản ghi cuối (daysAgo(6)) — cùng chu kỳ.
    });

    const result = await service.runCheck();

    expect(result.violated).toEqual(['Sale Demo Test']); // vẫn tính là đang vi phạm...
    expect(result.notified).toBe(0); // ...nhưng không gửi thêm.
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('Có Leader trong nhóm — gửi thêm 1 thông báo cho Leader', async () => {
    prisma.account.findMany.mockResolvedValue([
      { ...sale, team: { leader: { id: 'leader-1' } } },
    ]);
    prisma.shuttleRecord.findFirst.mockResolvedValue(null);

    const result = await service.runCheck();

    expect(result.notified).toBe(2);
    const call = prisma.notification.createMany.mock.calls[0][0];
    const recipientIds = call.data.map(
      (d: { accountId: string }) => d.accountId,
    );
    expect(recipientIds.sort()).toEqual(['leader-1', 'sale-1']);
  });

  it('seedTestData: không tìm thấy tài khoản Sale — báo lỗi rõ ràng', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    await expect(service.seedTestData('khong_ton_tai')).rejects.toThrow(
      'Không tìm thấy tài khoản Sale',
    );
  });

  it('seedTestData: dọn dữ liệu cũ + tạo đúng 1 bản ghi 5 ngày trước', async () => {
    prisma.account.findUnique.mockResolvedValue(sale);

    const result = await service.seedTestData('sale_demo_c');

    expect(prisma.shuttleRecord.deleteMany).toHaveBeenCalled();
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { accountId: 'sale-1', type: 'sale_no_shuttle_reminder' },
    });
    expect(prisma.shuttleRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sale: 'Sale Demo Test' }),
    });
    expect(result.account).toBe('Sale Demo Test');
  });
});

import { Test } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: {
    notification: { count: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const currentUser = {
    id: 'account-1',
    role: 'sale' as const,
    sessionId: 's',
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((queries: unknown[]) =>
        Promise.all(queries as Promise<unknown>[]),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(NotificationService);
  });

  it('Mục 7, docs/13: chỉ xem thông báo của chính mình — luôn lọc theo accountId = người gọi', async () => {
    await service.list({ page: 1, page_size: 20 }, currentUser);

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { accountId: 'account-1' },
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: 'account-1' },
      }),
    );
  });

  it('lọc thêm theo status khi có truyền tham số', async () => {
    await service.list({ page: 1, page_size: 20, status: 'sent' }, currentUser);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: 'account-1', status: 'sent' },
      }),
    );
  });

  it('phân trang đúng theo page/page_size', async () => {
    await service.list({ page: 3, page_size: 10 }, currentUser);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('trả về đúng cấu trúc PaginatedResult, ánh xạ đúng đối tượng Notification (Mục 0.1, docs/13)', async () => {
    prisma.notification.count.mockResolvedValue(1);
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'notif-1',
        accountId: 'account-1',
        leadId: 'lead-1',
        type: 'callback_reminder',
        channel: 'zalo',
        scheduledAt: new Date('2026-07-15T08:00:00.000Z'),
        sentAt: null,
        status: 'pending',
        createdAt: new Date('2026-07-15T07:00:00.000Z'),
      },
    ]);

    const result = await service.list({ page: 1, page_size: 20 }, currentUser);

    expect(result).toEqual({
      total: 1,
      page: 1,
      page_size: 20,
      items: [
        {
          id: 'notif-1',
          account_id: 'account-1',
          lead_id: 'lead-1',
          type: 'callback_reminder',
          channel: 'zalo',
          scheduled_at: '2026-07-15T08:00:00.000Z',
          sent_at: null,
          status: 'pending',
        },
      ],
    });
  });
});

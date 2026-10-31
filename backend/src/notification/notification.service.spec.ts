import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  DAILY_EXPIRING_NOTIFICATION_TYPES,
  DATA_NOTIFICATION_TYPES,
} from './notification-groups';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: {
    notification: {
      count: jest.Mock;
      findMany: jest.Mock;
      createMany: jest.Mock;
    };
    account: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  const currentUser = {
    id: 'account-1',
    role: 'sale' as const,
    sessionId: 's',
  };

  const adminUser = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };

  beforeEach(async () => {
    prisma = {
      notification: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      account: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((queries: unknown[]) =>
        Promise.all(queries as Promise<unknown>[]),
      ),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    const realtimeService = { emitNotificationCreated: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    service = moduleRef.get(NotificationService);
  });

  it('Mục 7, docs/13: chỉ xem thông báo của chính mình — luôn lọc theo accountId = người gọi', async () => {
    await service.list({ page: 1, page_size: 20 }, currentUser);

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ accountId: 'account-1' }),
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: 'account-1' }),
      }),
    );
  });

  it('lọc thêm theo status khi có truyền tham số', async () => {
    await service.list({ page: 1, page_size: 20, status: 'sent' }, currentUser);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: 'account-1',
          status: 'sent',
        }),
      }),
    );
  });

  it('Dự án phụ — nâng cấp toàn diện: Admin xem thêm được thông báo của các tài khoản Sale (cộng thông báo của chính mình)', async () => {
    await service.list({ page: 1, page_size: 20 }, adminUser);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { accountId: 'admin-1' },
            { account: { role: 'sale' }, type: { not: 'lead_assigned' } },
          ],
        }),
      }),
    );
  });

  it('Admin thấy thông báo của Sale (quy tắc cũ) NHƯNG không thấy loại "được chia data" của Sale khác — tránh ngập chuông', async () => {
    await service.list({ page: 1, page_size: 20 }, adminUser);

    const where = (
      prisma.notification.findMany.mock.calls[0] as [
        { where: { OR: Array<Record<string, unknown>> } },
      ]
    )[0].where;
    // Nhánh "thông báo của chính Admin" không bị lọc theo loại → Admin vẫn nhận lead_assigned của mình.
    expect(where.OR[0]).toEqual({ accountId: 'admin-1' });
    expect(where.OR[1]).toEqual({
      account: { role: 'sale' },
      type: { not: 'lead_assigned' },
    });
  });

  it('Dự án phụ — nâng cấp toàn diện: Admin vẫn lọc thêm được theo status', async () => {
    await service.list(
      { page: 1, page_size: 20, status: 'pending' },
      adminUser,
    );

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { accountId: 'admin-1' },
            { account: { role: 'sale' }, type: { not: 'lead_assigned' } },
          ],
          status: 'pending',
        }),
      }),
    );
  });

  describe('chuông 2 phần Data / Khác + Data hết hạn khi sang ngày mới (2026-11-01)', () => {
    const andClauses = () =>
      (
        prisma.notification.findMany.mock.calls[0] as [
          { where: { AND: Array<Record<string, unknown>> } },
        ]
      )[0].where.AND;

    it('group=data → chỉ các loại liên quan data', async () => {
      await service.list(
        { page: 1, page_size: 20, group: 'data' },
        currentUser,
      );
      expect(andClauses()[1]).toEqual({
        type: { in: [...DATA_NOTIFICATION_TYPES] },
      });
    });

    it('group=other → toàn bộ loại còn lại', async () => {
      await service.list(
        { page: 1, page_size: 20, group: 'other' },
        currentUser,
      );
      expect(andClauses()[1]).toEqual({
        type: { notIn: [...DATA_NOTIFICATION_TYPES] },
      });
    });

    it('không truyền group → không lọc theo nhóm (trả cả hai)', async () => {
      await service.list({ page: 1, page_size: 20 }, currentUser);
      expect(andClauses()[1]).toEqual({});
    });

    it('thông báo Data của ngày trước bị ẩn: mốc là 00:00 hôm nay giờ Việt Nam, thông báo Khác không bị ẩn', async () => {
      // 03:30 sáng 02/11/2026 giờ VN (= 20:30 UTC ngày 01/11) → mốc 00:00 02/11 VN = 17:00 UTC 01/11.
      jest.useFakeTimers().setSystemTime(new Date('2026-11-01T20:30:00.000Z'));
      try {
        await service.list({ page: 1, page_size: 20 }, currentUser);
      } finally {
        jest.useRealTimers();
      }
      expect(andClauses()[0]).toEqual({
        NOT: {
          type: { in: [...DAILY_EXPIRING_NOTIFICATION_TYPES] },
          createdAt: { lt: new Date('2026-11-01T17:00:00.000Z') },
        },
      });
    });

    it('áp dụng cả cho Admin (cùng điều kiện hết hạn + nhóm)', async () => {
      await service.list({ page: 1, page_size: 20, group: 'data' }, adminUser);
      expect(andClauses()).toHaveLength(2);
      expect(andClauses()[1]).toEqual({
        type: { in: [...DATA_NOTIFICATION_TYPES] },
      });
    });
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
        content: null,
        sender: null,
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
          content: null,
          sender: null,
          scheduled_at: '2026-07-15T08:00:00.000Z',
          sent_at: null,
          status: 'pending',
          meta: null,
        },
      ],
    });
  });

  describe('sendAdminMessage', () => {
    it('target_type=team: gửi cho toàn bộ tài khoản active thuộc các nhóm đã chọn', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-1' },
        { id: 'sale-2' },
      ]);

      const result = await service.sendAdminMessage(
        { content: 'Nghỉ lễ 2/9', target_type: 'team', target_ids: ['team-1'] },
        adminUser,
      );

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { teamId: { in: ['team-1'] }, status: 'active' },
        select: { id: true },
      });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            accountId: 'sale-1',
            senderId: 'admin-1',
            type: 'admin_message',
            channel: 'in_app',
            content: 'Nghỉ lễ 2/9',
            scheduledAt: expect.any(Date),
            sentAt: expect.any(Date),
            status: 'sent',
          },
          {
            accountId: 'sale-2',
            senderId: 'admin-1',
            type: 'admin_message',
            channel: 'in_app',
            content: 'Nghỉ lễ 2/9',
            scheduledAt: expect.any(Date),
            sentAt: expect.any(Date),
            status: 'sent',
          },
        ],
      });
      expect(result).toEqual({ recipient_count: 2 });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'create',
          entityType: 'notification',
        }),
      );
    });

    it('target_type=account: gửi cho đúng danh sách account_id đã chọn', async () => {
      prisma.account.findMany.mockResolvedValue([{ id: 'sale-3' }]);

      await service.sendAdminMessage(
        {
          content: 'Nhắc chốt số',
          target_type: 'account',
          target_ids: ['sale-3'],
        },
        adminUser,
      );

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['sale-3'] }, status: 'active' },
        select: { id: true },
      });
    });

    it('ném UnprocessableEntityException nếu không tìm thấy tài khoản active nào phù hợp', async () => {
      prisma.account.findMany.mockResolvedValue([]);

      await expect(
        service.sendAdminMessage(
          { content: 'x', target_type: 'team', target_ids: ['team-empty'] },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });
});

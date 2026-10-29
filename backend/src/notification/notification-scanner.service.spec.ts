import { Test } from '@nestjs/testing';
import { NotificationScannerService } from './notification-scanner.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

describe('NotificationScannerService', () => {
  let service: NotificationScannerService;
  let prisma: {
    callbackSchedule: { findMany: jest.Mock };
    interviewAppointment: { findMany: jest.Mock };
    notification: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };

  let realtimeService: { emitNotificationCreated: jest.Mock };

  /** Khớp đủ field toNotificationResponse() cần — mặc định cho notification.create(), tránh crash lúc phát realtime (Mục 3, mở rộng realtime — Thông báo). */
  const fullNotification = {
    id: 'notification-1',
    accountId: 'sale-1',
    leadId: 'lead-1',
    leaveRequestId: null,
    type: 'callback_reminder',
    channel: 'in_app',
    content: null,
    senderId: null,
    scheduledAt: new Date('2026-07-16T10:00:00.000Z'),
    sentAt: new Date('2026-07-16T10:00:00.000Z'),
    status: 'sent',
  };

  beforeEach(async () => {
    prisma = {
      callbackSchedule: { findMany: jest.fn().mockResolvedValue([]) },
      interviewAppointment: { findMany: jest.fn().mockResolvedValue([]) },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(fullNotification),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    realtimeService = { emitNotificationCreated: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationScannerService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    service = moduleRef.get(NotificationScannerService);
  });

  describe('Dự án phụ — nâng cấp toàn diện: chuông + toast trong ứng dụng đúng giờ hẹn gọi lại', () => {
    it('lịch đã đến giờ (scheduledAt <= now) → tạo ngay notification channel=in_app, status=sent, đúng nội dung', async () => {
      const scheduledAt = new Date(Date.now() - 30 * 1000);
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-1',
          scheduledAt,
          lead: {
            id: 'lead-1',
            fullName: 'Nguyễn Văn A',
            phoneNumber: '0901000001',
            assignedToId: 'sale-1',
          },
        },
      ]);

      const sent = await service.runInAppCallbackTick();

      expect(sent).toBe(1);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'sale-1',
          leadId: 'lead-1',
          type: 'callback_reminder',
          channel: 'in_app',
          status: 'sent',
          scheduledAt,
          content: expect.stringContaining(
            'Bạn có lịch gọi lại lao động Nguyễn Văn A, sđt 0901000001 vào lúc',
          ),
        }),
      });
    });

    it('lịch chưa đến giờ (scheduledAt trong tương lai) — không tạo thông báo', async () => {
      prisma.callbackSchedule.findMany.mockResolvedValue([]);

      const sent = await service.runInAppCallbackTick();

      expect(sent).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(prisma.callbackSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isCompleted: false,
            deletedAt: null,
            OR: [
              {
                repeatDaily: false,
                scheduledAt: { lte: expect.any(Date), gte: expect.any(Date) },
              },
              { repeatDaily: true, scheduledAt: { lte: expect.any(Date) } },
            ],
          }),
        }),
      );
    });

    it('đã có notification in_app đúng leadId+scheduledAt — không tạo trùng', async () => {
      const scheduledAt = new Date(Date.now() - 30 * 1000);
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-2',
          scheduledAt,
          lead: {
            id: 'lead-2',
            fullName: 'Trần Thị B',
            phoneNumber: '0901000002',
            assignedToId: 'sale-2',
          },
        },
      ]);
      prisma.notification.findFirst.mockResolvedValueOnce({ id: 'existing' });

      const sent = await service.runInAppCallbackTick();

      expect(sent).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('lịch "Mỗi ngày" bắt đầu từ 3 ngày trước: nhắc theo lần hôm nay (cùng giờ), chống trùng theo mốc đó', async () => {
      const DAY = 24 * 60 * 60 * 1000;
      const todayAt = new Date(Date.now() - 10 * 60 * 1000);
      const start = new Date(todayAt.getTime() - 3 * DAY);
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-daily',
          scheduledAt: start,
          repeatDaily: true,
          lead: {
            id: 'lead-9',
            fullName: 'Lặp Hằng Ngày',
            phoneNumber: '0901000009',
            assignedToId: 'sale-9',
          },
        },
      ]);

      const sent = await service.runInAppCallbackTick();

      expect(sent).toBe(1);
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ scheduledAt: todayAt }),
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'sale-9',
          scheduledAt: todayAt,
        }),
      });
    });

    it('lịch "Mỗi ngày" mà lần hôm nay đã quá 1 giờ — không nhắc bù', async () => {
      const DAY = 24 * 60 * 60 * 1000;
      const start = new Date(Date.now() - 2 * DAY - 3 * 60 * 60 * 1000);
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-daily-late',
          scheduledAt: start,
          repeatDaily: true,
          lead: {
            id: 'lead-10',
            fullName: 'Trễ',
            phoneNumber: '0901000010',
            assignedToId: 'sale-10',
          },
        },
      ]);

      const sent = await service.runInAppCallbackTick();

      expect(sent).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('lịch gọi lại chưa gán Sale (assignedToId null) — không tạo thông báo', async () => {
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-3',
          scheduledAt: new Date(Date.now() - 30 * 1000),
          lead: {
            id: 'lead-3',
            fullName: 'C',
            phoneNumber: '0901000003',
            assignedToId: null,
          },
        },
      ]);

      const sent = await service.runInAppCallbackTick();

      expect(sent).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('tickInAppCallback() (wrapper định kỳ) không throw ra ngoài kể cả khi lỗi toàn bộ', async () => {
      prisma.callbackSchedule.findMany.mockRejectedValue(new Error('DB down'));
      await expect(service.tickInAppCallback()).resolves.toBeUndefined();
    });
  });
});

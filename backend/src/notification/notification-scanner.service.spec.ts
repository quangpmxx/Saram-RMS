import { Test } from '@nestjs/testing';
import { NotificationScannerService } from './notification-scanner.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ZaloClientService } from './zalo-client.service';

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
  let systemConfigService: { getNotificationLeadMinutes: jest.Mock };
  let zaloClient: { send: jest.Mock };

  const LEAD_MINUTES = 15;

  beforeEach(async () => {
    prisma = {
      callbackSchedule: { findMany: jest.fn().mockResolvedValue([]) },
      interviewAppointment: { findMany: jest.fn().mockResolvedValue([]) },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    systemConfigService = {
      getNotificationLeadMinutes: jest.fn().mockResolvedValue(LEAD_MINUTES),
    };
    zaloClient = { send: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationScannerService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemConfigService, useValue: systemConfigService },
        { provide: ZaloClientService, useValue: zaloClient },
      ],
    }).compile();

    service = moduleRef.get(NotificationScannerService);
  });

  describe('Mục 9.8, docs/10 — lên lịch nhắc gọi lại', () => {
    it('tạo thông báo pending mới, đúng người phụ trách + đúng thời điểm nhắc (giờ hẹn - N phút)', async () => {
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000); // 1h nữa
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-1',
          scheduledAt,
          lead: { id: 'lead-1', assignedToId: 'sale-1' },
        },
      ]);

      await service.runTick();

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          accountId: 'sale-1',
          leadId: 'lead-1',
          type: 'callback_reminder',
          channel: 'zalo',
          scheduledAt: new Date(
            scheduledAt.getTime() - LEAD_MINUTES * 60 * 1000,
          ),
          status: 'pending',
        },
      });
    });

    it('lịch gọi lại chưa gán Sale (assignedToId null) — không tạo thông báo', async () => {
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-2',
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          lead: { id: 'lead-2', assignedToId: null },
        },
      ]);

      await service.runTick();

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('truy vấn đúng điều kiện: chỉ lịch CHƯA hoàn tất, lead chưa xóa và đã có người phụ trách', async () => {
      await service.runTick();

      expect(prisma.callbackSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isCompleted: false,
            lead: { deletedAt: null, assignedToId: { not: null } },
          },
        }),
      );
    });

    it('lịch hẹn bị dời giờ → cập nhật lại đúng thông báo pending sẵn có, không tạo trùng', async () => {
      const newScheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-3',
          scheduledAt: newScheduledAt,
          lead: { id: 'lead-3', assignedToId: 'sale-1' },
        },
      ]);
      const staleReminderAt = new Date(Date.now() + 30 * 60 * 1000);
      prisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notif-existing',
        accountId: 'sale-1',
        scheduledAt: staleReminderAt,
        status: 'pending',
      });

      await service.runTick();

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-existing' },
        data: {
          accountId: 'sale-1',
          scheduledAt: new Date(
            newScheduledAt.getTime() - LEAD_MINUTES * 60 * 1000,
          ),
        },
      });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('lead được chuyển sang Sale khác trước khi gửi → thông báo pending đổi đúng người phụ trách mới', async () => {
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-4',
          scheduledAt,
          lead: { id: 'lead-4', assignedToId: 'sale-NEW' },
        },
      ]);
      prisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notif-4',
        accountId: 'sale-OLD',
        scheduledAt: new Date(scheduledAt.getTime() - LEAD_MINUTES * 60 * 1000),
        status: 'pending',
      });

      await service.runTick();

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-4' },
        data: expect.objectContaining({ accountId: 'sale-NEW' }),
      });
    });

    it('đã có pending đúng người + đúng giờ — không gọi update/create thừa', async () => {
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
      const reminderAt = new Date(
        scheduledAt.getTime() - LEAD_MINUTES * 60 * 1000,
      );
      prisma.callbackSchedule.findMany.mockResolvedValue([
        {
          id: 'cb-5',
          scheduledAt,
          lead: { id: 'lead-5', assignedToId: 'sale-1' },
        },
      ]);
      prisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notif-5',
        accountId: 'sale-1',
        scheduledAt: reminderAt,
        status: 'pending',
      });

      await service.runTick();

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('lên lịch nhắc phỏng vấn', () => {
    it('chỉ quét lịch hẹn còn ở trạng thái "Đã hẹn PV" (SCHEDULED)', async () => {
      await service.runTick();

      expect(prisma.interviewAppointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { category: 'interview_status', code: 'SCHEDULED' },
            lead: { deletedAt: null, assignedToId: { not: null } },
          },
        }),
      );
    });

    it('tạo thông báo interview_reminder cho lịch hẹn PV sắp tới', async () => {
      const scheduledAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
      prisma.interviewAppointment.findMany.mockResolvedValue([
        {
          id: 'iv-1',
          scheduledAt,
          lead: { id: 'lead-6', assignedToId: 'sale-2' },
        },
      ]);

      await service.runTick();

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'sale-2',
          leadId: 'lead-6',
          type: 'interview_reminder',
        }),
      });
    });
  });

  describe('gửi thông báo đến hạn (Mục 6, docs/11 — quét theo status+scheduled_at)', () => {
    it('gửi thành công → đánh dấu sent, ghi sent_at', async () => {
      prisma.notification.findMany.mockResolvedValue([
        {
          id: 'notif-due-1',
          accountId: 'sale-1',
          leadId: 'lead-1',
          type: 'callback_reminder',
          scheduledAt: new Date(Date.now() - 60 * 1000),
          lead: { fullName: 'Nguyễn Văn A' },
        },
      ]);

      const result = await service.runTick();

      expect(zaloClient.send).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'sale-1', leadId: 'lead-1' }),
      );
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-due-1' },
        data: { status: 'sent', sentAt: expect.any(Date) },
      });
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('kênh Zalo lỗi/tắt — đánh dấu failed, KHÔNG throw, KHÔNG chặn thông báo còn lại', async () => {
      prisma.notification.findMany.mockResolvedValue([
        {
          id: 'notif-fail',
          accountId: 'sale-1',
          leadId: 'lead-1',
          type: 'callback_reminder',
          scheduledAt: new Date(Date.now() - 60 * 1000),
          lead: { fullName: 'Nguyễn Văn A' },
        },
        {
          id: 'notif-ok',
          accountId: 'sale-2',
          leadId: 'lead-2',
          type: 'interview_reminder',
          scheduledAt: new Date(Date.now() - 60 * 1000),
          lead: { fullName: 'Trần Thị B' },
        },
      ]);
      zaloClient.send
        .mockRejectedValueOnce(new Error('Zalo API down'))
        .mockResolvedValueOnce(undefined);

      await service.runTick();

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-fail' },
        data: { status: 'failed' },
      });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-ok' },
        data: { status: 'sent', sentAt: expect.any(Date) },
      });
    });

    it('tick() (wrapper định kỳ) không throw ra ngoài kể cả khi runTick lỗi toàn bộ', async () => {
      prisma.callbackSchedule.findMany.mockRejectedValue(new Error('DB down'));
      await expect(service.tick()).resolves.toBeUndefined();
    });
  });
});

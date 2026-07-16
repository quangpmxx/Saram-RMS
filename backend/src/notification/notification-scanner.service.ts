import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ZaloClientService } from './zalo-client.service';
import { toNotificationResponse } from './dto/notification-response.dto';
import { NotificationType } from '../../generated/prisma/enums';

/**
 * Mục 9.8, docs/10-system-design.md + Mục 2.14, docs/11-database-design.md
 * — worker nền quét định kỳ 2 mốc "sắp đến giờ" (lịch gọi lại chưa hoàn tất,
 * lịch hẹn PV còn ở trạng thái "Đã hẹn PV") và lên lịch nhắc Zalo cho nhân
 * viên phụ trách (`leads.assigned_to`) — đúng thuật ngữ "nhân viên phụ
 * trách" dùng xuyên suốt tài liệu 09/10.
 *
 * "Tần suất" nhắc (bao nhiêu phút trước giờ hẹn) chưa được chốt cụ thể tại
 * Mục 11.5, docs/09 — dùng đúng 1 tham số cấu hình duy nhất
 * (NOTIFICATION_LEAD_MINUTES, xem system-config.service.ts) khớp với cách
 * diễn đạt "gửi đúng thời điểm CẤU HÌNH" tại tiêu chí hoàn thành Phase 8,
 * docs/14-roadmap.md — không tự bịa thêm nhiều mốc nhắc (vd 1 ngày + 1 giờ
 * trước) vì không có căn cứ trong tài liệu.
 *
 * "Nội dung" thông báo cũng chưa được chốt (cùng Mục 11.5) và bảng
 * `notifications` (Design Freeze) không có cột lưu nội dung tin nhắn — nội
 * dung chỉ được dựng tạm thời ngay lúc gửi (xem buildMessage), không lưu lại.
 */
@Injectable()
export class NotificationScannerService {
  private readonly logger = new Logger(NotificationScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfigService: SystemConfigService,
    private readonly zaloClient: ZaloClientService,
    private readonly realtime: RealtimeService,
  ) {}

  @Interval(2 * 60 * 1000)
  async tick(): Promise<void> {
    try {
      const result = await this.runTick();
      if (result.scheduled > 0 || result.sent > 0 || result.failed > 0) {
        this.logger.log(
          `Thông báo Zalo: lên lịch ${result.scheduled}, đã gửi ${result.sent}, thất bại ${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error('Quét thông báo Zalo thất bại', error as Error);
    }
  }

  /** Tách riêng khỏi tick() để test/gọi thủ công được, không cần chờ timer. */
  async runTick(): Promise<{
    scheduled: number;
    sent: number;
    failed: number;
  }> {
    const leadMinutes =
      await this.systemConfigService.getNotificationLeadMinutes();
    const scheduledCallback = await this.syncCallbackReminders(leadMinutes);
    const scheduledInterview = await this.syncInterviewReminders(leadMinutes);
    const { sent, failed } = await this.sendDuePending();
    return {
      scheduled: scheduledCallback + scheduledInterview,
      sent,
      failed,
    };
  }

  private async syncCallbackReminders(leadMinutes: number): Promise<number> {
    const callbacks = await this.prisma.callbackSchedule.findMany({
      where: {
        isCompleted: false,
        lead: { deletedAt: null, assignedToId: { not: null } },
      },
      include: { lead: { select: { id: true, assignedToId: true } } },
    });

    let changedCount = 0;
    for (const callback of callbacks) {
      if (!callback.lead.assignedToId) continue;
      const reminderAt = new Date(
        callback.scheduledAt.getTime() - leadMinutes * 60 * 1000,
      );
      const changed = await this.upsertPendingReminder(
        callback.lead.assignedToId,
        callback.lead.id,
        'callback_reminder',
        reminderAt,
      );
      if (changed) changedCount++;
    }
    return changedCount;
  }

  private async syncInterviewReminders(leadMinutes: number): Promise<number> {
    const interviews = await this.prisma.interviewAppointment.findMany({
      where: {
        status: { category: 'interview_status', code: 'SCHEDULED' },
        lead: { deletedAt: null, assignedToId: { not: null } },
      },
      include: { lead: { select: { id: true, assignedToId: true } } },
    });

    let changedCount = 0;
    for (const interview of interviews) {
      if (!interview.lead.assignedToId) continue;
      const reminderAt = new Date(
        interview.scheduledAt.getTime() - leadMinutes * 60 * 1000,
      );
      const changed = await this.upsertPendingReminder(
        interview.lead.assignedToId,
        interview.lead.id,
        'interview_reminder',
        reminderAt,
      );
      if (changed) changedCount++;
    }
    return changedCount;
  }

  /**
   * Đảm bảo luôn có đúng 1 dòng "pending" cho mỗi (lead, loại nhắc), đúng
   * thời điểm và đúng người phụ trách hiện tại — tự sửa lại nếu lịch hẹn bị
   * dời hoặc lead được chuyển sang Sale khác trước khi thông báo được gửi.
   * Không đụng tới các dòng đã "sent"/"failed" (giữ nguyên lịch sử đã gửi).
   */
  private async upsertPendingReminder(
    accountId: string,
    leadId: string,
    type: NotificationType,
    reminderAt: Date,
  ): Promise<boolean> {
    const existingPending = await this.prisma.notification.findFirst({
      where: { leadId, type, status: 'pending' },
    });

    if (existingPending) {
      const needsUpdate =
        existingPending.accountId !== accountId ||
        existingPending.scheduledAt.getTime() !== reminderAt.getTime();
      if (!needsUpdate) return false;
      await this.prisma.notification.update({
        where: { id: existingPending.id },
        data: { accountId, scheduledAt: reminderAt },
      });
      return true;
    }

    // Tránh tạo trùng nếu đã có dòng "sent"/"failed" ứng đúng thời điểm này
    // (vd worker chạy lại ngay sau khi vừa gửi, trước khi lịch hẹn đổi).
    const alreadyHandled = await this.prisma.notification.findFirst({
      where: { leadId, type, scheduledAt: reminderAt },
    });
    if (alreadyHandled) return false;

    const created = await this.prisma.notification.create({
      data: {
        accountId,
        leadId,
        type,
        channel: 'zalo',
        scheduledAt: reminderAt,
        status: 'pending',
      },
    });
    // Job nền tự động (không có actor người dùng) — khớp đúng hành vi
    // polling hiện tại của NotificationBell (không lọc theo channel/status,
    // hiện luôn dòng "pending" này) — realtime chỉ đẩy sớm hơn, không đổi
    // dữ liệu hiển thị.
    this.realtime.emitNotificationCreated(
      toNotificationResponse(created),
      null,
    );
    return true;
  }

  private async sendDuePending(): Promise<{ sent: number; failed: number }> {
    const due = await this.prisma.notification.findMany({
      where: { status: 'pending', scheduledAt: { lte: new Date() } },
      include: { lead: { select: { fullName: true } } },
    });

    let sent = 0;
    let failed = 0;
    for (const notification of due) {
      try {
        await this.zaloClient.send({
          accountId: notification.accountId,
          leadId: notification.leadId,
          message: this.buildMessage(
            notification.type,
            notification.lead?.fullName ?? 'ứng viên',
          ),
        });
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'sent', sentAt: new Date() },
        });
        sent++;
      } catch (error) {
        this.logger.error(
          `Gửi thông báo Zalo thất bại (notification ${notification.id})`,
          error as Error,
        );
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'failed' },
        });
        failed++;
      }
    }
    return { sent, failed };
  }

  private buildMessage(type: NotificationType, leadFullName: string): string {
    return type === 'callback_reminder'
      ? `Nhắc lịch gọi lại ứng viên ${leadFullName}.`
      : `Nhắc lịch hẹn phỏng vấn ứng viên ${leadFullName}.`;
  }

  /**
   * Dự án phụ — nâng cấp toàn diện: chuông + toast TRONG ỨNG DỤNG đúng thời
   * điểm đặt lịch gọi lại (khác với syncCallbackReminders/sendDuePending ở
   * trên — nhắc qua Zalo, TRƯỚC giờ hẹn N phút theo cấu hình). Tách hẳn
   * thành 1 tick/method riêng, quét nhanh hơn (30s thay vì 2 phút) để đúng
   * yêu cầu "đến thời điểm đặt lịch" — NotificationBell (frontend) tự phát
   * hiện thông báo mới qua GET /notification, không cần API riêng.
   */
  @Interval(30 * 1000)
  async tickInAppCallback(): Promise<void> {
    try {
      const sent = await this.runInAppCallbackTick();
      if (sent > 0) {
        this.logger.log(
          `Thông báo trong ứng dụng (lịch gọi lại đến giờ): đã gửi ${sent}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Quét thông báo trong ứng dụng (lịch gọi lại) thất bại',
        error as Error,
      );
    }
  }

  /** Tách riêng khỏi tickInAppCallback() để test/gọi thủ công được, không cần chờ timer. */
  async runInAppCallbackTick(): Promise<number> {
    const now = new Date();
    // Chỉ bù các lịch đến hạn trong 1 giờ gần nhất — tránh dồn gửi hàng loạt
    // thông báo cũ nếu worker gián đoạn lâu (deploy lại, khởi động lại...).
    const graceWindowStart = new Date(now.getTime() - 60 * 60 * 1000);

    const dueCallbacks = await this.prisma.callbackSchedule.findMany({
      where: {
        isCompleted: false,
        scheduledAt: { lte: now, gte: graceWindowStart },
        lead: { deletedAt: null, assignedToId: { not: null } },
      },
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            assignedToId: true,
          },
        },
      },
    });

    let sentCount = 0;
    for (const callback of dueCallbacks) {
      if (!callback.lead.assignedToId) continue;

      const existing = await this.prisma.notification.findFirst({
        where: {
          leadId: callback.lead.id,
          type: 'callback_reminder',
          channel: 'in_app',
          scheduledAt: callback.scheduledAt,
        },
      });
      if (existing) continue;

      const created = await this.prisma.notification.create({
        data: {
          accountId: callback.lead.assignedToId,
          leadId: callback.lead.id,
          type: 'callback_reminder',
          channel: 'in_app',
          content: this.buildInAppCallbackMessage(
            callback.lead.fullName,
            callback.lead.phoneNumber,
            callback.scheduledAt,
          ),
          scheduledAt: callback.scheduledAt,
          sentAt: new Date(),
          status: 'sent',
        },
      });
      this.realtime.emitNotificationCreated(
        toNotificationResponse(created),
        null,
      );
      sentCount++;
    }
    return sentCount;
  }

  private buildInAppCallbackMessage(
    fullName: string,
    phoneNumber: string,
    scheduledAt: Date,
  ): string {
    const hh = String(scheduledAt.getHours()).padStart(2, '0');
    const mm = String(scheduledAt.getMinutes()).padStart(2, '0');
    const dd = String(scheduledAt.getDate()).padStart(2, '0');
    const MM = String(scheduledAt.getMonth() + 1).padStart(2, '0');
    const yyyy = scheduledAt.getFullYear();
    return `Bạn có lịch gọi lại lao động ${fullName}, sđt ${phoneNumber} vào lúc ${hh}:${mm} ngày ${dd}/${MM}/${yyyy}`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from './dto/notification-response.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Yêu cầu trực tiếp người dùng (2026-07-24): đã gỡ bỏ hẳn worker nhắc lịch
 * qua Zalo (Phase 8, dùng tham số cấu hình NOTIFICATION_LEAD_MINUTES) —
 * không còn sử dụng nữa. Class này giờ chỉ còn giữ tính năng riêng "thông
 * báo trong ứng dụng đúng thời điểm đặt lịch gọi lại" (tickInAppCallback bên
 * dưới), vốn không phụ thuộc tham số đã gỡ.
 */
@Injectable()
export class NotificationScannerService {
  private readonly logger = new Logger(NotificationScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Dự án phụ — nâng cấp toàn diện: chuông + toast TRONG ỨNG DỤNG đúng thời
   * điểm đặt lịch gọi lại (khác với worker nhắc qua Zalo TRƯỚC giờ hẹn N
   * phút đã gỡ bỏ, xem doc-comment đầu class). Quét nhanh hơn (30s thay vì
   * 2 phút) để đúng yêu cầu "đến thời điểm đặt lịch" — NotificationBell
   * (frontend) tự phát hiện thông báo mới qua GET /notification, không cần
   * API riêng.
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
        deletedAt: null,
        OR: [
          {
            repeatDaily: false,
            scheduledAt: { lte: now, gte: graceWindowStart },
          },
          { repeatDaily: true, scheduledAt: { lte: now } },
        ],
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
      // Lịch "Mỗi ngày": lần gần nhất đã tới giờ (cùng giờ mỗi ngày); dedupe
      // theo đúng mốc lần đó nên mỗi ngày nhắc đúng 1 lần.
      const dueAt = callback.repeatDaily
        ? new Date(
            callback.scheduledAt.getTime() +
              Math.floor(
                (now.getTime() - callback.scheduledAt.getTime()) / DAY_MS,
              ) *
                DAY_MS,
          )
        : callback.scheduledAt;
      if (dueAt < graceWindowStart) continue;

      const existing = await this.prisma.notification.findFirst({
        where: {
          leadId: callback.lead.id,
          type: 'callback_reminder',
          channel: 'in_app',
          scheduledAt: dueAt,
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
            dueAt,
          ),
          scheduledAt: dueAt,
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

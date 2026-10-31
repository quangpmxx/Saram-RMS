import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { toNotificationResponse } from './dto/notification-response.dto';

interface AssignedLead {
  id: string;
  fullName: string;
  phoneNumber: string;
}

/**
 * Thông báo cho Sale khi được chia/chuyển data (yêu cầu người dùng 2026-11-01):
 * chia thủ công, chia hàng loạt, chuyển data, tự động chia (kể cả khi nhập
 * Excel). Lưu vào chuông + đẩy realtime để hiện toast nổi + âm thanh, cùng cơ
 * chế với các thông báo khác. Lỗi gửi KHÔNG làm hỏng thao tác chia data.
 */
@Injectable()
export class LeadAssignmentNoticeService {
  private readonly logger = new Logger(LeadAssignmentNoticeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Người có quyền chia/chuyển 1 data cho `assigneeId` (Người gửi hiện trên thông báo). */
  notifyAssigned(
    lead: AssignedLead,
    assigneeId: string,
    actor: AuthenticatedUser,
    kind: 'assign' | 'transfer' = 'assign',
  ): Promise<void> {
    const verb = kind === 'transfer' ? 'chuyển' : 'chia';
    return this.send(
      assigneeId,
      lead.id,
      `Bạn được ${verb} data "${lead.fullName}" (${lead.phoneNumber})`,
      actor,
    );
  }

  /** Chia hàng loạt: 1 thông báo gộp cho mỗi người nhận (tránh dồn hàng chục toast). */
  notifyAssignedBulk(
    count: number,
    assigneeId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    return this.send(
      assigneeId,
      null,
      `Bạn được chia ${count} data mới`,
      actor,
    );
  }

  /** Hệ thống tự động chia 1 data (vòng quay) — không có người gửi. */
  notifyAutoAssigned(lead: AssignedLead, assigneeId: string): Promise<void> {
    return this.send(
      assigneeId,
      lead.id,
      `Hệ thống tự động chia cho bạn data "${lead.fullName}" (${lead.phoneNumber})`,
      null,
    );
  }

  /** Tự động chia nhiều data cùng lúc (nhập Excel) — 1 thông báo gộp cho mỗi người nhận. */
  notifyAutoAssignedBulk(count: number, assigneeId: string): Promise<void> {
    return this.send(
      assigneeId,
      null,
      `Hệ thống tự động chia cho bạn ${count} data mới`,
      null,
    );
  }

  private async send(
    accountId: string,
    leadId: string | null,
    content: string,
    sender: AuthenticatedUser | null,
  ): Promise<void> {
    // Tự chia cho chính mình (vd Sale tự nhận) thì không cần báo.
    if (sender && sender.id === accountId) return;
    try {
      const now = new Date();
      const notification = await this.prisma.notification.create({
        data: {
          accountId,
          leadId,
          type: 'lead_assigned',
          channel: 'in_app',
          content: content.slice(0, 500),
          senderId: sender?.id ?? null,
          scheduledAt: now,
          sentAt: now,
          status: 'sent',
        },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, avatarUrl: true },
          },
        },
      });
      this.realtime.emitNotificationCreated(
        toNotificationResponse(notification),
        sender,
      );
    } catch (error) {
      this.logger.error(
        `Gửi thông báo chia data thất bại (account=${accountId}, lead=${leadId ?? '-'})`,
        error as Error,
      );
    }
  }
}

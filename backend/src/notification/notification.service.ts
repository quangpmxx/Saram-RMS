import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { ListNotificationQueryDto } from './dto/list-notification-query.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import {
  NotificationResponseDto,
  toNotificationResponse,
} from './dto/notification-response.dto';

/**
 * Mục 7, docs/13-api-design.md — GET /notification. Quyền sử dụng: tất cả
 * vai trò đã đăng nhập, chỉ xem thông báo của chính mình (không có tham số
 * account_id — không thể xem thông báo của người khác).
 *
 * Dự án phụ — nâng cấp toàn diện: RIÊNG Admin xem thêm được toàn bộ thông
 * báo của các tài khoản vai trò Sale (cộng với thông báo của chính Admin)
 * — không mở rộng cho Quản lý/Leader/MKT, giữ đúng như yêu cầu trực tiếp
 * người dùng ("thông báo của sale cho cả admin thấy").
 */
@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    query: ListNotificationQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    const where =
      currentUser.role === 'admin'
        ? {
            OR: [
              { accountId: currentUser.id },
              { account: { role: 'sale' as const } },
            ],
            ...(query.status ? { status: query.status } : {}),
          }
        : {
            accountId: currentUser.id,
            ...(query.status ? { status: query.status } : {}),
          };

    const [total, notifications] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, avatarUrl: true },
          },
        },
        orderBy: { scheduledAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: notifications.map(toNotificationResponse),
    };
  }

  /**
   * Dự án phụ — nâng cấp toàn diện: POST /notification (chỉ Admin, xem
   * @Roles ở controller) — soạn + gửi thông báo trong ứng dụng cho 1 nhóm
   * hoặc nhiều tài khoản cụ thể. Tạo trực tiếp 1 hàng Notification/người
   * nhận với status='sent' (gửi ngay lập tức trong ứng dụng, không qua
   * hàng đợi/worker như 2 loại nhắc lịch Zalo hiện có).
   */
  async sendAdminMessage(
    dto: SendNotificationDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ recipient_count: number }> {
    const accounts = await this.prisma.account.findMany({
      where:
        dto.target_type === 'team'
          ? { teamId: { in: dto.target_ids }, status: 'active' }
          : { id: { in: dto.target_ids }, status: 'active' },
      select: { id: true },
    });
    const accountIds = [...new Set(accounts.map((a) => a.id))];

    if (accountIds.length === 0) {
      throw new UnprocessableEntityException(
        'Không tìm thấy tài khoản nào phù hợp với đối tượng đã chọn',
      );
    }

    const now = new Date();
    await this.prisma.notification.createMany({
      data: accountIds.map((accountId) => ({
        accountId,
        senderId: currentUser.id,
        type: 'admin_message' as const,
        channel: 'in_app' as const,
        content: dto.content,
        scheduledAt: now,
        sentAt: now,
        status: 'sent' as const,
      })),
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'notification',
      fieldChanged: 'content',
      newValue: dto.content,
    });

    return { recipient_count: accountIds.length };
  }
}

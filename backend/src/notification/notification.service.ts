import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { ListNotificationQueryDto } from './dto/list-notification-query.dto';
import {
  NotificationResponseDto,
  toNotificationResponse,
} from './dto/notification-response.dto';

/**
 * Mục 7, docs/13-api-design.md — GET /notification. Quyền sử dụng: tất cả
 * vai trò đã đăng nhập, chỉ xem thông báo của chính mình (không có tham số
 * account_id — không thể xem thông báo của người khác).
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListNotificationQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    const where = {
      accountId: currentUser.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, notifications] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
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
}

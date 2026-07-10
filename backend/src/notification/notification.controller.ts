import { Controller, Get, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ListNotificationQueryDto } from './dto/list-notification-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 7, docs/13-api-design.md. Không gắn @Roles() — tất cả vai trò đã đăng
 * nhập đều được xem, phạm vi giới hạn ngay trong NotificationService (chỉ
 * thông báo của chính mình).
 */
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(
    @Query() query: ListNotificationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.list(query, user);
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ListNotificationQueryDto } from './dto/list-notification-query.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 7, docs/13-api-design.md. GET không gắn @Roles() — tất cả vai trò đã
 * đăng nhập đều được xem, phạm vi giới hạn ngay trong NotificationService
 * (chỉ thông báo của chính mình).
 *
 * Dự án phụ — nâng cấp toàn diện: POST /notification (soạn + gửi thông báo
 * thủ công) — Admin và Quản lý (Quản lý thêm 2026-10-30, yêu cầu người dùng).
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

  /** Danh sách tài khoản đang hoạt động để chọn người nhận thông báo. */
  @Get('recipients')
  @Roles('admin', 'manager')
  recipients() {
    return this.notificationService.listRecipients();
  }

  @Post()
  @Roles('admin', 'manager')
  send(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.sendAdminMessage(dto, user);
  }
}

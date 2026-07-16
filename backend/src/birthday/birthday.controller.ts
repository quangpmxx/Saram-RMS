import { Controller, Get, Query } from '@nestjs/common';
import { BirthdayService } from './birthday.service';
import { ListBirthdayQueryDto } from './dto/list-birthday-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): "Giao diện chúc mừng sinh nhật
 * nhân viên" — Mục 6: "Không giới hạn theo nhóm, vì đây là hoạt động toàn
 * công ty." Không gắn @Roles() ở tầng controller — mọi vai trò đã đăng nhập
 * đều gọi được, giống ShuttleController (RolesGuard mặc định cho phép khi
 * không có @Roles(), xem roles.guard.ts).
 */
@Controller('birthday')
export class BirthdayController {
  constructor(private readonly birthdayService: BirthdayService) {}

  @Get('today')
  listToday(
    @Query() query: ListBirthdayQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.birthdayService.listToday(query, user);
  }
}

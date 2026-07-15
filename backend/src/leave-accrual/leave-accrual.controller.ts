import { Controller, ForbiddenException, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { LeaveAccrualService } from './leave-accrual.service';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13): endpoint thủ công để test cộng dồn phép ngay, không cần chờ
 * lịch cron 00:15 hằng ngày — cùng mẫu với SaleReminderController.
 */
@Controller('leave-accrual')
@Roles('admin')
export class LeaveAccrualController {
  constructor(private readonly leaveAccrualService: LeaveAccrualService) {}

  private assertNonProduction(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Endpoint này chỉ dùng được ở môi trường development',
      );
    }
  }

  /** Chạy ngay job cộng dồn phép, không cần chờ lịch cron 00:15 hằng ngày. */
  @Post('run')
  run() {
    this.assertNonProduction();
    return this.leaveAccrualService.runAccrual();
  }
}

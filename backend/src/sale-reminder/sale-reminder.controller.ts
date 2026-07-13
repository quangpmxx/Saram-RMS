import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { SaleReminderService } from './sale-reminder.service';
import { SeedSaleReminderTestDataDto } from './dto/seed-sale-reminder-test-data.dto';
import { Roles } from '../common/decorators/roles.decorator';

/**
 * Dự án phụ — nâng cấp toàn diện (ngoài phạm vi Design Freeze docs/09-13):
 * endpoint CHỈ dùng cho development/admin để test thủ công job nhắc "Sale
 * không có người phỏng vấn" (yêu cầu trực tiếp người dùng, mục 6 "Chế độ
 * test ngay") — không cần chờ lịch cron chạy hay chờ 3 ngày thật. Tự chặn
 * (403) khi NODE_ENV=production, tránh vô tình kích hoạt cảnh báo/dữ liệu
 * test ở môi trường thật.
 */
@Controller('sale-reminder')
@Roles('admin')
export class SaleReminderController {
  constructor(private readonly saleReminderService: SaleReminderService) {}

  private assertNonProduction(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Endpoint này chỉ dùng được ở môi trường development',
      );
    }
  }

  /** Chạy ngay job kiểm tra + gửi cảnh báo, không cần chờ lịch cron 08:00 hằng ngày. */
  @Post('run')
  run() {
    this.assertNonProduction();
    return this.saleReminderService.runCheck();
  }

  /** Dựng dữ liệu giả lập "đã quá 3 ngày không có người phỏng vấn" cho 1 tài khoản Sale có sẵn — để test runCheck() ngay. */
  @Post('seed-test-data')
  seedTestData(@Body() dto: SeedSaleReminderTestDataDto) {
    this.assertNonProduction();
    return this.saleReminderService.seedTestData(
      dto.sale_username ?? 'sale_demo_c',
    );
  }
}

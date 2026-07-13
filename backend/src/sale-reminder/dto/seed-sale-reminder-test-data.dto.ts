import { IsOptional, IsString } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (ngoài phạm vi Design Freeze docs/09-13):
 * POST /sale-reminder/seed-test-data — CHỈ dùng ở development, dựng dữ liệu
 * giả lập "đã quá 3 ngày không có người phỏng vấn" cho 1 tài khoản Sale có
 * sẵn (yêu cầu trực tiếp người dùng, mục 6 "Chế độ test ngay"). Không hard
 * code tài khoản trong logic job (SaleReminderService.runCheck chạy đúng
 * cho MỌI Sale) — `sale_username` để trống thì mặc định dùng 1 tài khoản
 * Sale mẫu có sẵn trong seed data, chỉ để tiện gọi nhanh khi test.
 */
export class SeedSaleReminderTestDataDto {
  @IsOptional()
  @IsString()
  sale_username?: string;
}

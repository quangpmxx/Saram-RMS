import { IsInt, Min } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới): 7 chỉ số nhập tay của báo cáo hằng ngày —
 * "Data mới" KHÔNG có trong DTO này vì không cho nhập tay (yêu cầu trực
 * tiếp người dùng), luôn tính riêng ở service.
 */
export class UpsertDailyReportDto {
  @IsInt()
  @Min(0)
  calls: number;

  @IsInt()
  @Min(0)
  old_data: number;

  @IsInt()
  @Min(0)
  no_answer: number;

  @IsInt()
  @Min(0)
  interested: number;

  @IsInt()
  @Min(0)
  interview_scheduled: number;

  @IsInt()
  @Min(0)
  interview_passed: number;

  @IsInt()
  @Min(0)
  employed: number;
}

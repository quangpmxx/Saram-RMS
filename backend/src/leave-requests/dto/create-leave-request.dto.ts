import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — POST /leave-request. `days_count`
 * KHÔNG có ở đây — luôn tính lại ở server từ start_date/end_date (Mục
 * "thiết kế logic", tránh client tự khai sai lệch với khoảng ngày thật).
 */
export class CreateLeaveRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipient_text?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason: string;

  /** Yêu cầu trực tiếp người dùng (2026-07-16): "Đã bàn giao công việc cho" bắt buộc nhập. */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  handover_to: string;
}

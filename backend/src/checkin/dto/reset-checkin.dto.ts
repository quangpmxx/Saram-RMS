import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 4, Mục
 * 8: "Khi Reset: Bắt buộc nhập lý do."
 */
export class ResetCheckinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

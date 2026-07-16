import { IsString, MaxLength } from 'class-validator';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): cột "Ghi chú" ở trang quản lý
 * Check in GPS — KHÔNG bắt buộc nhập (khác ResetCheckinDto.reason), gửi
 * chuỗi rỗng để xóa ghi chú.
 */
export class UpdateCheckinNoteDto {
  @IsString()
  @MaxLength(500)
  note: string;
}

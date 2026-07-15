import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 3, Mục
 * 11: "trang quản lý Check in" — lọc theo Ngày/Nhóm/Nhân viên/Trạng thái.
 * "Trạng thái" là 1 danh sách GỘP (Đã Check in/Chưa Check in/Hợp lệ/Ngoài
 * công ty/Cần xác minh) theo đúng yêu cầu người dùng, không tách 2 filter
 * riêng. KHÔNG phân trang (yêu cầu trực tiếp người dùng, 2026-07-15: quy mô
 * chỉ vài chục nhân viên/ngày, trả toàn bộ 1 lần — đã thử phân trang kiểu
 * trang Đưa đón rồi bỏ lại theo đúng phản hồi này).
 */
export const CHECKIN_STATUS_FILTER_VALUES = [
  'all',
  'checked_in',
  'not_checked_in',
  'valid',
  'outside_company',
  'needs_verification',
] as const;

export class ListCheckinQueryDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @IsOptional()
  @IsIn(CHECKIN_STATUS_FILTER_VALUES)
  status_filter?: (typeof CHECKIN_STATUS_FILTER_VALUES)[number];
}

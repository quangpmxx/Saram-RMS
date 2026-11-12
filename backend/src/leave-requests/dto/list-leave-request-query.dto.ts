import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { OFFICES, type Office } from '../../common/constants/office';

const STATUS_FILTER_VALUES = [
  'all',
  'pending_leader',
  'pending_admin',
  'approved',
  'rejected',
] as const;

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — GET /leave-request. KHÔNG
 * phân trang (khớp cách CheckinListResponseDto đã làm — quy mô nhỏ, vài
 * chục đơn/nhóm là nhiều, trả toàn bộ 1 lần theo đúng phạm vi RBAC).
 * `date_from`/`date_to` lọc theo NGÀY GỬI (created_at) — khớp đúng quy ước
 * đã dùng ở ListCandidatesQueryDto (lọc uploaded_at), không phát minh quy
 * ước mới cho bộ lọc ngày.
 */
export class ListLeaveRequestQueryDto {
  /** Tab văn phòng đang xem (2026-11-12): chỉ đơn của nhân viên thuộc văn phòng đó; không gửi = mọi văn phòng. */
  @IsOptional()
  @IsIn(OFFICES)
  office?: Office;

  @IsOptional()
  @IsIn(STATUS_FILTER_VALUES)
  status_filter?: (typeof STATUS_FILTER_VALUES)[number];

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

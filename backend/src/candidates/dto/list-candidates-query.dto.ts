import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export const LEAD_STATE_FILTERS = ['held', 'pending_close', 'closed'] as const;
export type LeadStateFilter = (typeof LEAD_STATE_FILTERS)[number];

/**
 * Mục 4, docs/13-api-design.md — GET /candidate (query).
 * Phase 1: từ khóa, nguồn, khoảng ngày, cờ trùng lặp.
 * Phase 2: bổ sung assigned_to, team_id, is_pending (M9 — filter theo đúng
 * trường dữ liệu Phase 2 tạo ra: assigned_to/assigned_team_id).
 * Phase 4: bổ sung call_status_id, call_result_id (còn thiếu từ Phase 3 —
 * dữ liệu đã có từ Phase 3 nhưng chưa từng lọc được), interview_status_id,
 * employment_status_id, partner_company_name — đúng danh sách query đã chốt
 * tại Mục 4, docs/13.
 * UI Polish: `keyword` mở rộng khớp thêm nội dung ghi chú chăm sóc
 * (lead_notes.content) ngoài tên/SĐT — theo yêu cầu trực tiếp người dùng,
 * vượt phạm vi mô tả gốc "tìm theo tên/SĐT" tại Mục 4, docs/13.
 */
export class ListCandidatesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size: number = 20;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsUUID('4')
  source_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsBooleanString()
  is_duplicate_flagged?: string;

  /** UUID của 1 account, hoặc chuỗi đặc biệt "me" (Mục 4, docs/13). */
  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsBooleanString()
  is_pending?: string;

  @IsOptional()
  @IsUUID('4')
  call_status_id?: string;

  @IsOptional()
  @IsUUID('4')
  call_result_id?: string;

  @IsOptional()
  @IsUUID('4')
  interview_status_id?: string;

  @IsOptional()
  @IsUUID('4')
  employment_status_id?: string;

  @IsOptional()
  @IsString()
  partner_company_name?: string;

  /**
   * Lọc trạng thái data ở tab Tất cả (yêu cầu người dùng 2026-10-30):
   * held = Đã giữ, pending_close = Chờ đóng (Sale đề nghị dừng chăm sóc, chờ
   * duyệt), closed = Đã đóng (đã dừng chăm sóc).
   */
  @IsOptional()
  @IsIn(LEAD_STATE_FILTERS)
  lead_state?: LeadStateFilter;
}

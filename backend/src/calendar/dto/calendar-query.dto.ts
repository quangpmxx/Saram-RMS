import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

/** Mục 7, docs/13-api-design.md — GET /calendar (query). */
export class CalendarQueryDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  /** Lọc theo lead thuộc về Sale này (assignedToId) — đã có sẵn, KHÔNG đổi ý nghĩa. */
  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  /**
   * Dự án phụ — nâng cấp toàn diện (yêu cầu trực tiếp người dùng,
   * 2026-07-14): lọc theo Sale ĐÃ TẠO lịch hẹn ("Sale hẹn" hiện ở mỗi dòng)
   * — KHÁC account_id (lead thuộc về ai) — tách riêng field để không đổi ý
   * nghĩa account_id đã có sẵn.
   */
  @IsOptional()
  @IsUUID('4')
  created_by_id?: string;

  /** Lọc riêng "Phỏng vấn" hoặc "Gọi lại" — để trống = cả 2 (hành vi gốc). */
  @IsOptional()
  @IsIn(['interview', 'callback'])
  type?: 'interview' | 'callback';
}

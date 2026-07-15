import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Mục 8, docs/13-api-design.md — dùng chung cho GET /dashboard/summary,
 * /dashboard/performance, /dashboard/by-team, /report/by-source
 * (by-team không dùng team_id — Quản lý/Admin xem tất cả nhóm cùng lúc).
 *
 * Dự án phụ — nâng cấp toàn diện (riêng giao diện Dashboard, ngoài phạm vi
 * Design Freeze docs/09-13): thêm account_id/source_id — 2 trường lọc MỚI
 * chỉ DashboardService đọc tới (getBySource ở report.controller.ts KHÔNG
 * đọc 2 trường này nên /report/by-source không đổi hành vi gì).
 */
export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  /** Lọc theo 1 Sale cụ thể — Sale role tự bỏ qua tham số này (đã bị khóa đúng phạm vi bản thân, xem buildScope()). */
  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @IsOptional()
  @IsUUID('4')
  source_id?: string;
}

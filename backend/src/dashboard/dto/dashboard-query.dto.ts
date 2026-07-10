import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Mục 8, docs/13-api-design.md — dùng chung cho GET /dashboard/summary,
 * /dashboard/performance, /dashboard/by-team, /report/by-source
 * (by-team không dùng team_id — Quản lý/Admin xem tất cả nhóm cùng lúc).
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
}

import { IsOptional, IsUUID } from 'class-validator';
import { DashboardQueryDto } from './dashboard-query.dto';

/** Mục 8, docs/13-api-design.md — GET /report/funnel (query). */
export class ReportFunnelQueryDto extends DashboardQueryDto {
  @IsOptional()
  @IsUUID('4')
  account_id?: string;
}

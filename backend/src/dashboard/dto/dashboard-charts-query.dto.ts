import { IsOptional, Matches } from 'class-validator';

/** GET /dashboard/charts — tab Biểu đồ: năm (trống = năm nay), tháng 1-12 (trống = cả năm). */
export class DashboardChartsQueryDto {
  @IsOptional()
  @Matches(/^20\d{2}$/)
  year?: string;

  @IsOptional()
  @Matches(/^(0?[1-9]|1[0-2])$/)
  month?: string;
}

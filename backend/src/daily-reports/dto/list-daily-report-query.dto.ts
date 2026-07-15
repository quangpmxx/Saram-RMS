import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/** Dự án phụ — nâng cấp toàn diện: GET /daily-report, GET /daily-report/summary (query). */
export class ListDailyReportQueryDto {
  /** Để trống = hôm nay (theo giờ Việt Nam) — "báo cáo hằng ngày" mặc định xem đúng hôm nay. */
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsUUID('4')
  account_id?: string;
}

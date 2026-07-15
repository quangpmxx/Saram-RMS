import { IsDateString, IsOptional } from 'class-validator';

/**
 * Mục 11, yêu cầu người dùng: "Có thể truyền thời điểm giả lập vào job" —
 * CHỈ dùng ở development (xem assertNonProduction() ở controller).
 */
export class RunReportPenaltyScanDto {
  @IsOptional()
  @IsDateString()
  simulated_at?: string;
}

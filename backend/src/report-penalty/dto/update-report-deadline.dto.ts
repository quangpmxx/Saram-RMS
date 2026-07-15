import { IsInt, Max, Min } from 'class-validator';

/** Mục 5, yêu cầu người dùng: "Cài đặt thời hạn báo cáo" — Giờ/Phút, chỉ Admin. */
export class UpdateReportDeadlineDto {
  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute: number;
}

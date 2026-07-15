import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 2.
 * GET /checkin/preview?latitude=..&longitude=..&accuracy=.. — dry-run tính
 * khoảng cách/trạng thái, không ghi DB.
 */
export class CheckinPreviewQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy: number;
}

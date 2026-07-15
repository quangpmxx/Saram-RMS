import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 2, Mục
 * 7: "Latitude từ -90 đến 90. Longitude từ -180 đến 180. Bán kính phải lớn
 * hơn 0."
 */
export class UpdateCompanyLocationDto {
  @IsString()
  @MaxLength(500)
  address: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsInt()
  @Min(1)
  allowed_radius_meters: number;
}

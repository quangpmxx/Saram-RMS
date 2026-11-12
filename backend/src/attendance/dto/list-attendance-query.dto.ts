import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { OFFICES, type Office } from '../../common/constants/office';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới): GET /attendance — chỉ lọc theo tháng/năm (Mục
 * 10, yêu cầu trực tiếp người dùng: "Chỉ cần bộ lọc theo tháng").
 */
export class ListAttendanceQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  /** Tab văn phòng đang xem (2026-11-12) — không gửi = mọi văn phòng trong phạm vi được xem. */
  @IsOptional()
  @IsIn(OFFICES)
  office?: Office;

  /** Mục 6, yêu cầu người dùng: mặc định ẩn tài khoản đã ngừng hoạt động. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  include_inactive?: boolean;
}

import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Kho chăm sóc — GET /care-warehouse (query). Ngày dạng "YYYY-MM-DD" giờ Việt Nam. */
export class ListCareWarehouseQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  page_size: number = 20;

  /** "assigned" = chỉ data đang được giao cho chính người xem (bộ lọc "Được giao" của Sale). */
  @IsOptional()
  @IsIn(['all', 'assigned'])
  scope: 'all' | 'assigned' = 'all';

  @IsOptional()
  @IsIn(['not_cared', 'cared', 'assigned_pending'])
  status?: 'not_cared' | 'cared' | 'assigned_pending';

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  /** Sale đang được giao (lượt giao còn hiệu lực). */
  @IsOptional()
  @IsUUID('4')
  assignee_id?: string;

  /** Lọc theo TỔNG số lần chăm sóc từ trước đến nay. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  care_count_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  care_count_max?: number;

  @IsOptional()
  @Matches(DATE_ONLY)
  last_care_from?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  last_care_to?: string;

  /** Khoảng ngày cho thống kê Được giao / Đã xử lý / Chưa xử lý ở đầu Kho. Bỏ trống from = không giới hạn đầu. */
  @IsOptional()
  @Matches(DATE_ONLY)
  stats_from?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  stats_to?: string;

  /** Lọc theo ngày phân công gần nhất. */
  @IsOptional()
  @Matches(DATE_ONLY)
  assigned_from?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  assigned_to?: string;

  /** Tìm theo họ tên hoặc số điện thoại. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

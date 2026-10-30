import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  SORT_ORDERS,
  type SortOrder,
} from '../../common/utils/sort-order.util';

/** Cột bấm tiêu đề để sắp xếp (yêu cầu người dùng 2026-10-30): STT / Ngày sinh / Ngày vào. */
export const DS_SALE_SORTS = ['stt', 'date_of_birth', 'join_date'] as const;
export type DsSaleSort = (typeof DS_SALE_SORTS)[number];

/** GET /sales-entry/ds-sale — query lọc + phân trang (Mục 10/11, yêu cầu người dùng). */
export class ListDsSaleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Mặc định 100 dòng/trang, cho chọn 50/100/200 (Mục 11). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  page_size: number = 100;

  /** Tìm theo Mã NV, Họ tên, CMT/CCCD, Quê quán (Mục 10). */
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsDateString()
  join_date_from?: string;

  @IsOptional()
  @IsDateString()
  join_date_to?: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  sale_user_id?: string;

  @IsOptional()
  @IsUUID()
  pickup_user_id?: string;

  @IsOptional()
  @IsIn(DS_SALE_SORTS)
  sort?: DsSaleSort;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}

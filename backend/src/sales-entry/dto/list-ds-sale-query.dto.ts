import { Type } from 'class-transformer';
import {
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

/**
 * 4 tab nhỏ của "Nhập doanh số" (2026-11-12) dùng chung bảng/API này:
 * DS Sale, DS Media, DS Tuyển dụng, DS Đưa đón.
 */
export const DS_KINDS = [
  'sale',
  'media',
  'recruitment',
  'shuttle',
  // Tab lớn "Nhập thưởng" — danh sách thưởng để Kế toán chi.
  'bonus',
] as const;
export type DsKind = (typeof DS_KINDS)[number];

/** Chỉ cần biết đang ở tab nào (vd lấy danh sách người chọn được). */
/** Tháng/năm hiện tại theo giờ Việt Nam (UTC+7) — kỳ mặc định của trang Nhập DS/Thưởng. */
export function currentVnPeriod(): { year: number; month: number } {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return { year: vnNow.getUTCFullYear(), month: vnNow.getUTCMonth() + 1 };
}

export class DsKindQueryDto {
  @IsOptional()
  @IsIn(DS_KINDS)
  kind?: DsKind;
}

/** GET /sales-entry/ds-sale — query lọc + phân trang (Mục 10/11, yêu cầu người dùng). */
export class ListDsSaleQueryDto {
  /** Tab đang xem — không gửi = DS Sale (như trước). */
  @IsOptional()
  @IsIn(DS_KINDS)
  kind?: DsKind;

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

  /** Kỳ đang xem (như Chấm công) — không gửi = tháng hiện tại theo giờ Việt Nam. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  sale_user_id?: string;

  @IsOptional()
  @IsUUID()
  pickup_user_id?: string;

  /** Chỉ tab Nhập thưởng: yes = đã có Ngày chi, no = chưa chi. */
  @IsOptional()
  @IsIn(['yes', 'no'])
  paid?: 'yes' | 'no';

  @IsOptional()
  @IsIn(DS_SALE_SORTS)
  sort?: DsSaleSort;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}

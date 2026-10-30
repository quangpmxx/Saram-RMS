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

/** Cột bấm tiêu đề để sắp xếp (yêu cầu người dùng 2026-10-30): Ngày / STT (trong ngày) / Giờ PV. */
export const SHUTTLE_SORTS = ['date', 'stt', 'interview_time'] as const;
export type ShuttleSort = (typeof SHUTTLE_SORTS)[number];

/** Dự án phụ — nâng cấp toàn diện: GET /shuttle (Danh sách đưa đón) — query. */
export class ListShuttleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Yêu cầu: mặc định 20 dòng/trang, cho chọn 20/50/100. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  page_size: number = 20;

  /** Tìm theo tên hoặc SĐT. */
  @IsOptional()
  @IsString()
  keyword?: string;

  /**
   * Dự án phụ — nâng cấp toàn diện: đổi từ lọc đúng 1 ngày (equality) sang
   * khoảng ngày [date_from, date_to] — khớp bộ lọc ngày dùng chung kiểu
   * Google Analytics (yêu cầu trực tiếp người dùng: "y hệt như ảnh", đối
   * chiếu đúng theo cách GET /candidate đã làm với date_from/date_to).
   */
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  /** Yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng" — lọc theo OrderRecord.id thật. */
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsString()
  type?: string;

  /** Yêu cầu trực tiếp người dùng (2026-07-28): lọc theo Account.id thật, không còn chuỗi tự do. */
  @IsOptional()
  @IsUUID()
  sale_user_id?: string;

  @IsOptional()
  @IsUUID()
  driver_user_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  /** "Kết quả" (Đỗ phỏng vấn/Trượt phỏng vấn) — lọc riêng khỏi "status" (yêu cầu trực tiếp người dùng). */
  @IsOptional()
  @IsString()
  interview_result?: string;

  @IsOptional()
  @IsIn(SHUTTLE_SORTS)
  sort?: ShuttleSort;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}

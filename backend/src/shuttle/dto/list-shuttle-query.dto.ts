import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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
  @Max(100)
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

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  sale?: string;

  @IsOptional()
  @IsString()
  driver?: string;

  @IsOptional()
  @IsString()
  status?: string;

  /** "Kết quả" (Đỗ phỏng vấn/Trượt phỏng vấn) — lọc riêng khỏi "status" (yêu cầu trực tiếp người dùng). */
  @IsOptional()
  @IsString()
  interview_result?: string;
}

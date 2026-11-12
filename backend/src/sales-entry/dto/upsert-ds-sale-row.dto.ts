import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DS_KINDS, type DsKind } from './list-ds-sale-query.dto';

/** Ô ngày trên bảng gửi "" khi người dùng xóa trắng — coi như null, không phải lỗi định dạng. */
const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, yêu cầu trực tiếp người dùng
 * — "DS Sale" trong module Nhập doanh số): dùng chung cho tạo mới (POST) và
 * lưu lại toàn bộ 1 dòng (PUT) — khớp đúng cách bảng nhập liệu kiểu sheet
 * gửi lên (autosave theo DÒNG, không phải theo từng ô riêng lẻ). Mọi
 * trường đều tùy chọn — dòng nháp trống hợp lệ ở tầng DTO, việc chặn lưu
 * bản ghi hoàn toàn rỗng nằm ở service (SalesEntryService.isRowBlank()).
 */
export class UpsertDsSaleRowDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employee_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  date_of_birth?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  identity_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hometown?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  join_date?: string | null;

  @IsOptional()
  @IsUUID()
  company_id?: string | null;

  @IsOptional()
  @IsUUID()
  sale_user_id?: string | null;

  @IsOptional()
  @IsUUID()
  pickup_user_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /** Tab đang nhập — chỉ dùng khi TẠO dòng (sửa không đổi được loại); không gửi = DS Sale. */
  @IsOptional()
  @IsIn(DS_KINDS)
  kind?: DsKind;

  /** Kỳ (tháng/năm đang xem) — chỉ dùng khi TẠO dòng; không gửi = tháng hiện tại. */
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  period_year?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  period_month?: number;

  // ── Chỉ DS Media / DS Tuyển dụng / DS Đưa đón dùng (2026-11-12) ──
  @IsOptional()
  @IsString()
  @MaxLength(255)
  work_status?: string;

  @IsOptional()
  @IsUUID()
  check_user_id?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(9999)
  total_days?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(99999)
  total_hours?: number | null;

  // ── Chỉ tab Nhập thưởng dùng (2026-11-12) ──
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99_999_999_999)
  amount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bank_account_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bank_account_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referrer_name?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  paid_date?: string | null;
}

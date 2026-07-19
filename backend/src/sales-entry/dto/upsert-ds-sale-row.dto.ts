import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

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
}

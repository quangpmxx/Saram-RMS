import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Ô "company" trên bảng gửi "" khi bỏ trống (khớp quy ước "" = chưa nhập của các ô khác) — coi như null, không phải lỗi định dạng UUID. */
const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

/** Dự án phụ — nâng cấp toàn diện: PUT /shuttle/:id — mọi trường tự do, không bắt buộc. */
export class UpdateShuttleDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_number?: string;

  /** Yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng" — tham chiếu OrderRecord thật, không còn chuỗi tự do. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  company_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  sale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  driver?: string;

  // Xem ghi chú tương tự ở create-shuttle.dto.ts — "" = chưa nhập.
  @IsOptional()
  @IsString()
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Giờ phỏng vấn không hợp lệ (định dạng HH:mm)',
  })
  interview_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contractor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  interview_result?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

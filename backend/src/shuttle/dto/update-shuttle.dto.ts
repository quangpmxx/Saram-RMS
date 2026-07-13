import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

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

import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AccountStatus } from '../../../generated/prisma/enums';

/**
 * Mục 2, docs/13-api-design.md — PUT /account/:id (full_name, team_id,
 * status sửa được). Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm
 * vi Design Freeze docs/09-13, yêu cầu trực tiếp người dùng): thêm 5 field
 * hồ sơ nhân sự, CHỈ Admin sửa được (đã gắn @Roles('admin') cấp controller
 * cho toàn bộ /account, xem accounts.controller.ts). Cho phép `null` ở mọi
 * field mới để Admin xóa/reset về trống — @IsOptional() bỏ qua validate khi
 * giá trị là null hoặc undefined (class-validator), khớp cách team_id đã
 * làm.
 */
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @IsOptional()
  @IsUUID('4', { message: 'team_id không hợp lệ' })
  team_id?: string | null;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  /** "YYYY-MM-DD" */
  @IsOptional()
  @IsDateString()
  date_of_birth?: string | null;

  /** "YYYY-MM-DD" */
  @IsOptional()
  @IsDateString()
  hire_date?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  personal_phone?: string | null;

  @IsOptional()
  @IsEmail()
  personal_email?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  remaining_leave_days?: number | null;

  /** Bổ sung 2026-07-15 (yêu cầu trực tiếp người dùng): CCCD + STK. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  citizen_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  bank_account_number?: string | null;
}

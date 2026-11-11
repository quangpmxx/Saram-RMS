import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const RECRUITMENT_KINDS = ['official', 'seasonal'] as const;
export const RECRUITMENT_STATUSES = ['open', 'limited', 'paused'] as const;

const MAX_MONEY = 2_000_000_000;
const LONG_TEXT = 4000;

/** Các trường của 1 thẻ tuyển dụng — dùng chung cho thêm và sửa (gửi trường nào sửa trường đó). */
export class UpdateRecruitmentPostingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên công ty không được để trống' })
  @MaxLength(255)
  company_name?: string;

  /** Nhóm sở hữu thẻ — chỉ Admin/Quản lý được chọn; vai trò khác luôn là nhóm mình. */
  @IsOptional()
  @IsUUID()
  team_id?: string | null;

  @IsOptional()
  @IsIn(RECRUITMENT_KINDS)
  kind?: (typeof RECRUITMENT_KINDS)[number];

  @IsOptional()
  @IsIn(RECRUITMENT_STATUSES)
  status?: (typeof RECRUITMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string | null;

  @IsOptional()
  @IsBoolean()
  accept_male?: boolean;

  @IsOptional()
  @IsBoolean()
  accept_female?: boolean;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(80)
  age_min?: number | null;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(80)
  age_max?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  requirement?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY)
  base_salary?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY)
  allowance?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  salary_note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bonus_summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  bonus?: string | null;

  /**
   * Nhãn nhanh để Sale lọc. Có sẵn vài mã chuẩn (sitting, no_gate, dorm, bus,
   * tattoo_ok, phone_ok, bonus — tên hiển thị ở frontend recruitment-shared.ts);
   * người sửa lịch gõ thêm nhãn mới tuỳ ý, nhãn nào đang dùng thì tự hiện ở bộ lọc.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  interview_slot?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  work?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  documents?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  housing?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  pros?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  cons?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  notes?: string | null;

  /** Tin Zalo tự viết; trống = phần mềm tự soạn. */
  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  zalo_message?: string | null;
}

/** POST /recruitment-schedule — bắt buộc có tên công ty và loại (chính thức/thời vụ). */
export class CreateRecruitmentPostingDto extends UpdateRecruitmentPostingDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên công ty không được để trống' })
  @MaxLength(255)
  declare company_name: string;

  @IsIn(RECRUITMENT_KINDS)
  declare kind: (typeof RECRUITMENT_KINDS)[number];
}

/** POST /recruitment-schedule/assign-team — gán mọi thẻ chưa có nhóm cho 1 nhóm (Admin/Quản lý). */
export class AssignTeamDto {
  @IsUUID()
  team_id: string;
}

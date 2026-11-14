import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OFFICES, type Office } from '../../common/constants/office';

const ATTENDANCE_STATUSES = [
  'present',
  'half',
  'paid_leave',
  'unpaid_leave',
  'holiday',
  'compensatory_leave',
] as const;

export class SheetMonthQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsOptional()
  @IsIn(OFFICES)
  office?: Office;
}

/** Tháng tuỳ chọn: không gửi = bảng công gần nhất đã gửi cho mình. */
export class MySheetQueryDto {
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
}

export class SendSheetsDto extends SheetMonthQueryDto {
  /** Không gửi = gửi cho mọi người trong phạm vi chưa được gửi tháng này. Có = gửi (lại) đúng những người này. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  account_ids?: string[];
}

export class DisputedDayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  expected?: (typeof ATTENDANCE_STATUSES)[number] | null;
}

export class RespondSheetDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsIn(['confirm', 'dispute'])
  action: 'confirm' | 'dispute';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(31)
  @ValidateNested({ each: true })
  @Type(() => DisputedDayDto)
  days?: DisputedDayDto[];
}

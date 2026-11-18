import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BONUS_GROUPS,
  type BonusGroup,
} from '../../sales-entry/dto/list-ds-sale-query.dto';

/** GET /labor-bonus — trang Kế toán › Thưởng lao động. */
export class LaborBonusQueryDto {
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

  /** Không gửi = tab Chung (mọi bộ phận). */
  @IsOptional()
  @IsIn(BONUS_GROUPS)
  group?: BonusGroup;

  @IsOptional()
  @IsIn(['yes', 'no'])
  paid?: 'yes' | 'no';

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}

export class MarkLaborBonusPaidDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  ids: string[];

  /** Ngày chi — không gửi = hôm nay (giờ Việt Nam). */
  @IsOptional()
  @IsDateString()
  paid_date?: string;
}

export class UnmarkLaborBonusPaidDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  ids: string[];
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpsertComponentDto {
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'Mã chỉ gồm chữ in hoa không dấu, số và gạch dưới (vd PHU_CAP_AN_TRUA)',
  })
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsIn(['income', 'allowance', 'deduction', 'info'])
  nature: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  formula?: string | null;

  @IsOptional()
  @IsBoolean()
  show_on_payslip?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

export class TemplateItemDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  formula?: string | null;
}

export class UpsertTemplateDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsArray()
  @IsString({ each: true })
  roles: string[];

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items: TemplateItemDto[];
}

export class UpdateAccountSettingDto {
  @IsNumber()
  @Min(0)
  base_salary: number;

  @IsNumber()
  @Min(0)
  commission_rate: number;

  @IsOptional()
  @IsUUID()
  template_id?: string | null;

  /** { MÃ_THÀNH_PHẦN: "công thức riêng" } */
  @IsOptional()
  @IsObject()
  overrides?: Record<string, string>;

  /** Ngày chính thức (YYYY-MM-DD) — trước ngày này hưởng lương thử việc. */
  @IsOptional()
  @IsDateString()
  official_date?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bank_account_holder?: string | null;
}

export class CommissionRateItemDto {
  @IsUUID()
  company_id: string;

  @IsNumber()
  @Min(0)
  rate_per_hour: number;
}

export class SaveCommissionRatesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionRateItemDto)
  rates: CommissionRateItemDto[];
}

export class CreatePayrollDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

export class PayrollStatusDto {
  @IsIn(['lock', 'unlock', 'send', 'complete'])
  action: 'lock' | 'unlock' | 'send' | 'complete';
}

export class UpdateSlipDto {
  /** Số tiền các khoản nhập tay: { MÃ_KHOẢN: số tiền }. */
  @IsObject()
  manual_values: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class RespondSlipDto {
  @IsIn(['confirm', 'question'])
  action: 'confirm' | 'question';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  question?: string;
}

export class PreviewTemplateDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items: TemplateItemDto[];

  @IsOptional()
  @IsUUID()
  account_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;
}

export class PreviewQueryDto {
  @IsOptional()
  @IsUUID()
  account_id?: string;
}

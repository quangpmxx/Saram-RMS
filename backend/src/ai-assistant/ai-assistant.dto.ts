import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  Max,
  Min,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SaveAiConfigDto {
  /** Bỏ trống = giữ khoá cũ, chỉ đổi mô hình. */
  @IsOptional() @IsString() @MaxLength(200) api_key?: string;
  @IsOptional() @IsString() @MaxLength(100) model?: string;
}

export class SaveAiKnowledgeDto {
  @IsOptional() @IsString() @MaxLength(60) assistant_name?: string;
  /** Trợ lý là ai, ai tạo ra, cách xưng hô… */
  @IsOptional() @IsString() @MaxLength(4000) persona?: string;
  /** Sổ tay công ty. */
  @IsOptional() @IsString() @MaxLength(30000) knowledge?: string;
  @IsOptional() @IsBoolean() allow_chitchat?: boolean;
  /** Kỹ năng Sale & kịch bản xử lý tình huống lao động. */
  @IsOptional() @IsString() @MaxLength(30000) sales_playbook?: string;
}

export class SaveAiBudgetDto {
  /** USD / tháng; null = không giới hạn. */
  @IsOptional() @IsNumber() @Min(0) @Max(1000) monthly_budget_usd?:
    number | null;
}

export class SpeakAiDto {
  @IsString() @MinLength(1) @MaxLength(2000) text!: string;
}

export class ListAiModelsDto {
  @IsOptional() @IsString() @MaxLength(200) api_key?: string;
}

export class AiHistoryItemDto {
  @IsIn(['user', 'model']) role!: 'user' | 'model';
  @IsString() @MaxLength(2000) text!: string;
}

export class AskAiDto {
  @IsString() @MinLength(1) @MaxLength(1000) question!: string;

  /** Vài lượt hỏi–đáp trước để hiểu câu hỏi nối tiếp ("còn hôm qua thì sao?"). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AiHistoryItemDto)
  history?: AiHistoryItemDto[];
}

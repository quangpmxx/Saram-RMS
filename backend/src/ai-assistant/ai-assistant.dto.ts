import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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

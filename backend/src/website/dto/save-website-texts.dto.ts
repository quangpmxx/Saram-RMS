import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Mã đoạn chữ: chữ thường, số, dấu chấm, gạch ngang/dưới. */
export const WEBSITE_TEXT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,149}$/;

export class WebsiteTextItemDto {
  @IsString()
  @Matches(WEBSITE_TEXT_KEY_PATTERN, { message: 'Mã đoạn chữ không hợp lệ' })
  key: string;

  @IsString()
  // 20.000: đủ cho danh sách mục / khối thêm mới lưu dạng JSON (list.*, custom.*, pages).
  @MaxLength(20000, { message: 'Đoạn chữ tối đa 20.000 ký tự' })
  value: string;
}

export class SaveWebsiteTextsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => WebsiteTextItemDto)
  items: WebsiteTextItemDto[];
}

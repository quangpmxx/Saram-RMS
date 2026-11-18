import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Ảnh hợp lệ: chỉ ảnh đã tải lên qua POST /website/images. */
export const WEBSITE_IMAGE_PATTERN =
  /^\/uploads\/website\/[\w-]+\.(jpg|png|webp)$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Chuỗi rỗng → null (xoá giá trị). */
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

/** Tin việc làm — tạo/sửa (sửa: mọi trường đều tuỳ chọn). */
export class SaveWebsiteJobDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Tên việc tối thiểu 3 ký tự' })
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  company?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  area?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  salary?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  shift?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @Matches(WEBSITE_IMAGE_PATTERN, { message: 'Ảnh không hợp lệ' })
  image?: string | null;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export const WEBSITE_POST_KINDS = ['news', 'album'] as const;

/** Tin tức / album — tạo/sửa. */
export class SaveWebsitePostDto {
  @IsOptional()
  @IsIn(WEBSITE_POST_KINDS)
  kind?: (typeof WEBSITE_POST_KINDS)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Tiêu đề tối thiểu 3 ký tự' })
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(50000)
  body?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @Matches(WEBSITE_IMAGE_PATTERN, { message: 'Ảnh bìa không hợp lệ' })
  cover?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(WEBSITE_IMAGE_PATTERN, {
    each: true,
    message: 'Ảnh trong album không hợp lệ',
  })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class ListWebsitePostsQueryDto {
  @IsOptional()
  @IsIn(WEBSITE_POST_KINDS)
  kind?: (typeof WEBSITE_POST_KINDS)[number];
}

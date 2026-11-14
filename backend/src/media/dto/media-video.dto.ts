import {
  IsBoolean,
  IsDateString,
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
import { MEDIA_PLATFORMS } from './media.dto';

/** Sổ video: thêm / sửa 1 dòng (gửi trường nào sửa trường đó; null = xoá). */
export class MediaVideoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @IsOptional()
  @IsDateString()
  work_date?: string | null;

  @IsOptional()
  @IsUUID()
  content_group_id?: string | null;

  /** Người quay = người phụ trách chính của công việc. */
  @IsOptional()
  @IsUUID()
  shooter_id?: string | null;

  @IsOptional()
  @IsUUID()
  editor_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  raw_link?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  done_link?: string | null;

  /** Sổ video chỉ đổi 3 bước: chưa dựng / đang dựng / xong. */
  @IsOptional()
  @IsIn(['todo', 'in_progress', 'done'])
  status?: 'todo' | 'in_progress' | 'done';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;

  @IsOptional()
  @IsUUID()
  channel_id?: string | null;

  @IsOptional()
  @IsBoolean()
  posted?: boolean;

  @IsOptional()
  @IsDateString()
  post_date?: string | null;
}

export class MediaContentGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên nhóm không được để trống' })
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color_key?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sort_order?: number;
}

export class MediaChannelDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên kênh không được để trống' })
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsIn(MEDIA_PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  url?: string | null;

  @IsOptional()
  @IsUUID()
  owner_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color_key?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

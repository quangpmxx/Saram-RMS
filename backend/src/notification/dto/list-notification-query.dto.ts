import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

/** Mục 7, docs/13-api-design.md — GET /notification (query). */
export class ListNotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size: number = 20;

  @IsOptional()
  @IsIn(['pending', 'sent', 'failed'])
  status?: 'pending' | 'sent' | 'failed';

  /** Nhóm chuông (2026-11-01): 'data' = thông báo liên quan data; 'other' = còn lại; bỏ trống = tất cả. */
  @IsOptional()
  @IsIn(['data', 'other'])
  group?: 'data' | 'other';
}

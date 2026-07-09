import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Mục 4, docs/13-api-design.md — GET /candidate (query).
 * Phase 1 chỉ hiện thực bộ lọc "cơ bản" theo đúng M9 (cơ bản) tại
 * docs/14-roadmap.md: từ khóa, nguồn, khoảng ngày, cờ trùng lặp — các
 * filter theo trạng thái cuộc gọi/PV/nhóm/sale thuộc Phase 2-4, chưa có
 * dữ liệu để lọc nên chưa hiện thực ở đây.
 */
export class ListCandidatesQueryDto {
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
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsUUID('4')
  source_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsBooleanString()
  is_duplicate_flagged?: string;
}

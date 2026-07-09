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
 * Phase 1: từ khóa, nguồn, khoảng ngày, cờ trùng lặp.
 * Phase 2: bổ sung assigned_to, team_id, is_pending (M9 — filter theo đúng
 * trường dữ liệu Phase 2 tạo ra: assigned_to/assigned_team_id). Các filter
 * theo trạng thái cuộc gọi/PV thuộc Phase 3-4, chưa có dữ liệu nên chưa
 * hiện thực ở đây.
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

  /** UUID của 1 account, hoặc chuỗi đặc biệt "me" (Mục 4, docs/13). */
  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsBooleanString()
  is_pending?: string;
}

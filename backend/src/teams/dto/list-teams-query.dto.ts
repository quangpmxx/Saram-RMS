import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Mục 3, docs/13-api-design.md — GET /team (query) */
export class ListTeamsQueryDto {
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
}

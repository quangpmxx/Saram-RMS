import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Kho chăm sóc — GET /care-warehouse/batches (lịch sử đợt phân công). */
export class ListBatchesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size: number = 20;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;
}

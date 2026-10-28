import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Kho chăm sóc — POST /care-warehouse/random/preview. Truyền ĐÚNG 1 trong 2:
 * `per_assignee` (số data cho từng Sale) hoặc `total` (tổng số data, chia
 * đều cho các Sale được chọn).
 */
export class RandomPreviewDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  assignee_ids: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  per_assignee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  total?: number;
}

export class RandomPairDto {
  @IsUUID('4')
  lead_id: string;

  @IsUUID('4')
  assignee_id: string;
}

/** Kho chăm sóc — POST /care-warehouse/random/confirm: gửi lại đúng danh sách đã xem trước. */
export class RandomConfirmDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => RandomPairDto)
  pairs: RandomPairDto[];
}

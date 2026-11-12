import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
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

  /**
   * Lọc loại data muốn giao theo số lần chăm sóc trong 30 ngày: 0, 1, 2, 3,
   * 4 (= 4 lần trở lên). Bỏ trống = không lọc. Chọn nhiều = hợp của các nhóm.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsIn([0, 1, 2, 3, 4], { each: true })
  care_counts?: number[];

  /**
   * Chỉ chia data có Ngày lên số trong khoảng này — theo bộ lọc "Ngày lên số"
   * đang chọn ở Kho (2026-11-10). Bỏ trống = toàn bộ Kho.
   */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  uploaded_from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  uploaded_to?: string;
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

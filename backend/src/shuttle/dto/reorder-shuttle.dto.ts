import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsUUID,
} from 'class-validator';

/**
 * PUT /shuttle/reorder — kéo thả sắp xếp dòng trong 1 ngày (2026-11-10).
 * `ids`: các dòng ĐANG HIỆN của ngày đó theo thứ tự mới (từ trên xuống, thứ tự
 * mặc định "STT tăng"). Dòng của ngày đó không hiện (đang lọc/khác trang) giữ chỗ cũ.
 */
export class ReorderShuttleDto {
  @IsDateString()
  date: string;

  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  ids: string[];
}

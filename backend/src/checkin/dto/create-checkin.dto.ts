import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 2. GPS
 * do trình duyệt cung cấp — backend validate biên độ hợp lệ nhưng KHÔNG
 * (và không thể) xác thực đây có phải vị trí thật hay không (Mục 9).
 */
export class CreateCheckinDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  /** Mét — độ chính xác GPS trình duyệt trả về. */
  @IsNumber()
  @Min(0)
  accuracy: number;

  /** Địa chỉ dễ đọc từ reverse geocoding phía client — chỉ để hiển thị/lưu tham khảo, không dùng tính trạng thái. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolved_address?: string;
}

import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SHUTTLE_OPTION_COLORS } from '../../shuttle/dto/create-shuttle-option.dto';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-26, yêu cầu trực tiếp người dùng):
 * PUT /order-management/:id — sửa tên và/hoặc màu 1 đơn hàng đã có.
 */
export class UpdateOrderRecordDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên đơn hàng không được để trống' })
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(SHUTTLE_OPTION_COLORS)
  color_key?: string | null;

  @IsOptional()
  @IsIn(SHUTTLE_OPTION_COLORS)
  text_color_key?: string | null;
}

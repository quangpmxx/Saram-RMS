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
 * POST /order-management — thêm 1 đơn hàng mới, kèm màu nền/màu chữ tự chọn.
 * Tái dùng đúng bảng màu SHUTTLE_OPTION_COLORS của Danh sách đưa đón (yêu
 * cầu trực tiếp người dùng: "giống như trang đưa đón lao động"), không tự
 * định nghĩa bảng màu riêng.
 */
export class CreateOrderRecordDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên đơn hàng không được để trống' })
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsIn(SHUTTLE_OPTION_COLORS)
  color_key?: string;

  @IsOptional()
  @IsIn(SHUTTLE_OPTION_COLORS)
  text_color_key?: string;
}

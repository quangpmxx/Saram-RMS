import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SHUTTLE_OPTION_COLORS } from './create-shuttle-option.dto';

/**
 * Dự án phụ — nâng cấp toàn diện: PUT /shuttle/options/:id — sửa lại 1 giá
 * trị gợi ý đã thêm (đổi tên và/hoặc đổi màu), yêu cầu trực tiếp người dùng:
 * "Có thêm nút chỉnh sửa những dữ liệu đã thêm nữa". Chỉ sửa dòng
 * shuttle_options — KHÔNG cập nhật lại các dòng shuttle_records đang dùng
 * giá trị cũ (giữ nguyên nguyên tắc "chỉ là gợi ý", giống DELETE).
 */
export class UpdateShuttleOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Giá trị không được để trống' })
  @MaxLength(150)
  value?: string;

  @IsOptional()
  @IsIn(SHUTTLE_OPTION_COLORS)
  color_key?: string | null;

  /** Dự án phụ — nâng cấp toàn diện: màu CHỮ riêng, độc lập với color_key (màu nền) — yêu cầu trực tiếp người dùng. */
  @IsOptional()
  @IsIn(SHUTTLE_OPTION_COLORS)
  text_color_key?: string | null;
}

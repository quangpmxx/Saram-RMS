import { ShuttleOption } from '../../../generated/prisma/client';

/**
 * Dự án phụ — nâng cấp toàn diện: GET /shuttle/options — danh sách gợi ý CÓ
 * LƯU LẠI (bảng shuttle_options, xem schema.prisma) của 7 trường "chọn" —
 * mỗi mục kèm màu nền đã chọn (color_key), có thể xóa riêng (DELETE
 * /shuttle/options/:id) mà không đụng dữ liệu các dòng đưa đón đã nhập.
 */
export interface ShuttleOptionItemDto {
  id: string;
  value: string;
  color_key: string | null;
  /** Dự án phụ — nâng cấp toàn diện: màu CHỮ riêng, độc lập với color_key (màu nền) — null = dùng màu chữ tương phản tự động theo color_key. */
  text_color_key: string | null;
}

export interface ShuttleOptionsResponseDto {
  companies: ShuttleOptionItemDto[];
  areas: ShuttleOptionItemDto[];
  types: ShuttleOptionItemDto[];
  sales: ShuttleOptionItemDto[];
  drivers: ShuttleOptionItemDto[];
  contractors: ShuttleOptionItemDto[];
  statuses: ShuttleOptionItemDto[];
  interviewResults: ShuttleOptionItemDto[];
  interviewTimes: ShuttleOptionItemDto[];
}

export function toShuttleOptionItem(
  option: ShuttleOption,
): ShuttleOptionItemDto {
  return {
    id: option.id,
    value: option.value,
    color_key: option.colorKey,
    text_color_key: option.textColorKey,
  };
}

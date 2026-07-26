import { OrderRecord } from '../../../generated/prisma/client';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-26): GET /order-management —
 * danh sách đơn hàng, mỗi dòng kèm màu nền/màu chữ đã chọn.
 */
export interface OrderRecordResponseDto {
  id: string;
  name: string;
  color_key: string | null;
  text_color_key: string | null;
  created_at: string;
}

export function toOrderRecordResponse(
  record: OrderRecord,
): OrderRecordResponseDto {
  return {
    id: record.id,
    name: record.name,
    color_key: record.colorKey,
    text_color_key: record.textColorKey,
    created_at: record.createdAt.toISOString(),
  };
}

import { IsOptional, IsUUID } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện: PUT /candidate/:id/zalo-status (body).
 * zalo_status_id = null nghĩa là bỏ chọn (chỉ 1 lựa chọn thật "Đã gửi
 * CCCD" — bấm lần 2 để bỏ chọn, xem candidates-client.tsx).
 */
export class UpdateZaloStatusDto {
  @IsOptional()
  @IsUUID('4')
  zalo_status_id: string | null;
}

import { IsUUID } from 'class-validator';

/** Dự án phụ — nâng cấp toàn diện: PUT /candidate/:id/zalo-status (body). */
export class UpdateZaloStatusDto {
  @IsUUID('4')
  zalo_status_id: string;
}

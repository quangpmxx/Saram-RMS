import { IsUUID } from 'class-validator';

/** Yêu cầu trực tiếp người dùng (2026-07-16) — POST /candidate/:id/remind (body). */
export class RemindCallbackDto {
  @IsUUID('4')
  account_id: string;
}

import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Mục 5, docs/13-api-design.md — POST /candidate/:id/transfer (body).
 * Gửi new_account_id (chuyển cho Sale cùng nhóm) HOẶC new_team_id (chuyển
 * sang nhóm khác, data về "Chờ phân chia" — 2026-11-15).
 */
export class TransferCandidateDto {
  @IsOptional()
  @IsUUID('4')
  new_account_id?: string;

  @IsOptional()
  @IsUUID('4')
  new_team_id?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

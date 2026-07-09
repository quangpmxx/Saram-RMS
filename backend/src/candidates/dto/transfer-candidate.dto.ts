import { IsOptional, IsString, IsUUID } from 'class-validator';

/** Mục 5, docs/13-api-design.md — POST /candidate/:id/transfer (body). */
export class TransferCandidateDto {
  @IsUUID('4')
  new_account_id: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

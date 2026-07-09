import { IsUUID } from 'class-validator';

/** Mục 5, docs/13-api-design.md — POST /candidate/:id/assign (body). */
export class AssignCandidateDto {
  @IsUUID('4')
  account_id: string;
}

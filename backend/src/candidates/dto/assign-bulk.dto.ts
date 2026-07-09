import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Mục 5, docs/13-api-design.md — POST /candidate/assign-bulk (body). */
export class AssignBulkDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  candidate_ids: string[];

  @IsUUID('4')
  account_id: string;
}

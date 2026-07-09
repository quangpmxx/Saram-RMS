import { IsUUID } from 'class-validator';

/** Mục 6, docs/13-api-design.md — PUT /candidate/:id/call-result (body). */
export class UpdateCallResultDto {
  @IsUUID('4')
  call_result_id: string;
}

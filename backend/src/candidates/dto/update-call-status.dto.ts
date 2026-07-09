import { IsUUID } from 'class-validator';

/** Mục 6, docs/13-api-design.md — PUT /candidate/:id/call-status (body). */
export class UpdateCallStatusDto {
  @IsUUID('4')
  call_status_id: string;
}

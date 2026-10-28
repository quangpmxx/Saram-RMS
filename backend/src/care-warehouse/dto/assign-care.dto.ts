import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Kho chăm sóc — POST /care-warehouse/assign (giao thủ công nhiều data cho 1 Sale). */
export class AssignCareDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  lead_ids: string[];

  @IsUUID('4')
  assignee_id: string;
}

/** Kho chăm sóc — POST /care-warehouse/:leadId/reassign. */
export class ReassignCareDto {
  @IsUUID('4')
  assignee_id: string;
}

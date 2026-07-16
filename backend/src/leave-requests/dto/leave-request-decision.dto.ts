import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Yêu cầu trực tiếp người dùng (2026-07-16) — POST /leave-request/:id/leader-decision, /admin-decision. */
export class LeaveRequestDecisionDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

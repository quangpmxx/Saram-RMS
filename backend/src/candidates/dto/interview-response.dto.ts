import {
  Account,
  InterviewAppointment,
  StatusCatalog,
} from '../../../generated/prisma/client';

/** Đối tượng "Interview" dùng chung — Mục 0.1, docs/13-api-design.md. */
export interface InterviewResponseDto {
  id: string;
  lead_id: string;
  attempt_no: number;
  partner_company_name: string;
  scheduled_at: string;
  status: { id: string; name: string };
  employment_status: { id: string; name: string } | null;
  employment_reason: string | null;
  created_by: { id: string; name: string };
  created_at: string;
}

type InterviewWithRelations = InterviewAppointment & {
  status: Pick<StatusCatalog, 'id' | 'name'>;
  employmentStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
  createdBy: Pick<Account, 'id' | 'fullName'>;
};

export function toInterviewResponse(
  interview: InterviewWithRelations,
): InterviewResponseDto {
  return {
    id: interview.id,
    lead_id: interview.leadId,
    attempt_no: interview.attemptNo,
    partner_company_name: interview.partnerCompanyName,
    scheduled_at: interview.scheduledAt.toISOString(),
    status: { id: interview.status.id, name: interview.status.name },
    employment_status: interview.employmentStatus
      ? {
          id: interview.employmentStatus.id,
          name: interview.employmentStatus.name,
        }
      : null,
    employment_reason: interview.employmentReason,
    created_by: {
      id: interview.createdBy.id,
      name: interview.createdBy.fullName,
    },
    created_at: interview.createdAt.toISOString(),
  };
}

export const INTERVIEW_INCLUDE = {
  status: { select: { id: true, name: true } },
  employmentStatus: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
} as const;

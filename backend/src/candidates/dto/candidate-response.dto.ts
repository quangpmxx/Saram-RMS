import {
  Account,
  Lead,
  LeadSource,
  StatusCatalog,
} from '../../../generated/prisma/client';

/** Đối tượng "Candidate" dùng chung — Mục 0.1, docs/13-api-design.md. */
export interface CandidateResponseDto {
  id: string;
  full_name: string;
  phone_number: string;
  birth_year: number | null;
  address: string | null;
  source: { id: string; name: string };
  mkt_note: string | null;
  data_quality_score: number | null;
  uploaded_by: { id: string; name: string };
  uploaded_at: string;
  assigned_to: { id: string; name: string } | null;
  assigned_team_id: string | null;
  assigned_at: string | null;
  assignment_method: string | null;
  call_status: { id: string; name: string } | null;
  call_result: { id: string; name: string } | null;
  is_held: boolean;
  held_by: { id: string; name: string } | null;
  held_at: string | null;
  last_activity_at: string | null;
  entered_care_pool_at: string | null;
  care_pool_locked_by: { id: string; name: string } | null;
  is_duplicate_flagged: boolean;
  created_at: string;
  updated_at: string;
}

type LeadWithRelations = Lead & {
  source: Pick<LeadSource, 'id' | 'name'>;
  uploadedBy: Pick<Account, 'id' | 'fullName'>;
  assignedTo?: Pick<Account, 'id' | 'fullName'> | null;
  heldBy?: Pick<Account, 'id' | 'fullName'> | null;
  carePoolLockedBy?: Pick<Account, 'id' | 'fullName'> | null;
  callStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
  callResult?: Pick<StatusCatalog, 'id' | 'name'> | null;
};

export function toCandidateResponse(
  lead: LeadWithRelations,
): CandidateResponseDto {
  return {
    id: lead.id,
    full_name: lead.fullName,
    phone_number: lead.phoneNumber,
    birth_year: lead.birthYear,
    address: lead.address,
    source: { id: lead.source.id, name: lead.source.name },
    mkt_note: lead.mktNote,
    data_quality_score: lead.dataQualityScore,
    uploaded_by: { id: lead.uploadedBy.id, name: lead.uploadedBy.fullName },
    uploaded_at: lead.uploadedAt.toISOString(),
    assigned_to: lead.assignedTo
      ? { id: lead.assignedTo.id, name: lead.assignedTo.fullName }
      : null,
    assigned_team_id: lead.assignedTeamId,
    assigned_at: lead.assignedAt?.toISOString() ?? null,
    assignment_method: lead.assignmentMethod,
    call_status: lead.callStatus
      ? { id: lead.callStatus.id, name: lead.callStatus.name }
      : null,
    call_result: lead.callResult
      ? { id: lead.callResult.id, name: lead.callResult.name }
      : null,
    is_held: lead.isHeld,
    held_by: lead.heldBy
      ? { id: lead.heldBy.id, name: lead.heldBy.fullName }
      : null,
    held_at: lead.heldAt?.toISOString() ?? null,
    last_activity_at: lead.lastActivityAt?.toISOString() ?? null,
    entered_care_pool_at: lead.enteredCarePoolAt?.toISOString() ?? null,
    care_pool_locked_by: lead.carePoolLockedBy
      ? { id: lead.carePoolLockedBy.id, name: lead.carePoolLockedBy.fullName }
      : null,
    is_duplicate_flagged: lead.isDuplicateFlagged,
    created_at: lead.createdAt.toISOString(),
    updated_at: lead.updatedAt.toISOString(),
  };
}

/** Cụm quan hệ dùng chung khi truy vấn Lead, khớp đúng shape trên. */
export const CANDIDATE_INCLUDE = {
  source: { select: { id: true, name: true } },
  uploadedBy: { select: { id: true, fullName: true } },
  assignedTo: { select: { id: true, fullName: true } },
  heldBy: { select: { id: true, fullName: true } },
  carePoolLockedBy: { select: { id: true, fullName: true } },
  callStatus: { select: { id: true, name: true } },
  callResult: { select: { id: true, name: true } },
} as const;

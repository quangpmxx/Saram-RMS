import {
  Account,
  AccountRole,
  Lead,
  LeadSource,
  NoteColor,
  StatusCatalog,
} from '../../../generated/prisma/client';

/**
 * Dự án phụ — nâng cấp toàn diện (bổ sung field, KHÔNG đổi field cũ nào):
 * kèm `role` bên cạnh mọi tài khoản thực hiện hành động — yêu cầu trực tiếp
 * người dùng: "Các vai trò như admin, quản lý, leader thì thao tác ở đâu
 * cũng phải mở ngoặc vai trò cạnh tên". Dùng chung 1 type cho mọi chỗ tham
 * chiếu tài khoản trong Candidate (uploaded_by/assigned_to/held_by/
 * care_pool_locked_by).
 */
export interface NamedRefWithRole {
  id: string;
  name: string;
  role: AccountRole;
  avatar_url: string | null;
}

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
  uploaded_by: NamedRefWithRole;
  uploaded_at: string;
  assigned_to: NamedRefWithRole | null;
  assigned_team_id: string | null;
  assigned_at: string | null;
  assignment_method: string | null;
  call_status: { id: string; name: string } | null;
  call_result: { id: string; name: string } | null;
  zalo_status: { id: string; name: string } | null;
  zalo_friend_status: { id: string; name: string } | null;
  note_color: NoteColor | null;
  current_interview_status: { id: string; name: string } | null;
  current_employment_status: { id: string; name: string } | null;
  current_partner_company_name: string | null;
  is_held: boolean;
  held_by: NamedRefWithRole | null;
  held_at: string | null;
  last_activity_at: string | null;
  entered_care_pool_at: string | null;
  care_pool_locked_by: NamedRefWithRole | null;
  is_duplicate_flagged: boolean;
  created_at: string;
  updated_at: string;
}

type LeadWithRelations = Lead & {
  source: Pick<LeadSource, 'id' | 'name'>;
  uploadedBy: Pick<Account, 'id' | 'fullName' | 'role' | 'avatarUrl'>;
  assignedTo?: Pick<Account, 'id' | 'fullName' | 'role' | 'avatarUrl'> | null;
  heldBy?: Pick<Account, 'id' | 'fullName' | 'role' | 'avatarUrl'> | null;
  carePoolLockedBy?: Pick<
    Account,
    'id' | 'fullName' | 'role' | 'avatarUrl'
  > | null;
  callStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
  callResult?: Pick<StatusCatalog, 'id' | 'name'> | null;
  zaloStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
  zaloFriendStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
  currentInterviewStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
  currentEmploymentStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
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
    uploaded_by: {
      id: lead.uploadedBy.id,
      name: lead.uploadedBy.fullName,
      role: lead.uploadedBy.role,
      avatar_url: lead.uploadedBy.avatarUrl,
    },
    uploaded_at: lead.uploadedAt.toISOString(),
    assigned_to: lead.assignedTo
      ? {
          id: lead.assignedTo.id,
          name: lead.assignedTo.fullName,
          role: lead.assignedTo.role,
          avatar_url: lead.assignedTo.avatarUrl,
        }
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
    zalo_status: lead.zaloStatus
      ? { id: lead.zaloStatus.id, name: lead.zaloStatus.name }
      : null,
    zalo_friend_status: lead.zaloFriendStatus
      ? { id: lead.zaloFriendStatus.id, name: lead.zaloFriendStatus.name }
      : null,
    note_color: lead.noteColor,
    current_interview_status: lead.currentInterviewStatus
      ? {
          id: lead.currentInterviewStatus.id,
          name: lead.currentInterviewStatus.name,
        }
      : null,
    current_employment_status: lead.currentEmploymentStatus
      ? {
          id: lead.currentEmploymentStatus.id,
          name: lead.currentEmploymentStatus.name,
        }
      : null,
    current_partner_company_name: lead.currentPartnerCompanyName,
    is_held: lead.isHeld,
    held_by: lead.heldBy
      ? {
          id: lead.heldBy.id,
          name: lead.heldBy.fullName,
          role: lead.heldBy.role,
          avatar_url: lead.heldBy.avatarUrl,
        }
      : null,
    held_at: lead.heldAt?.toISOString() ?? null,
    last_activity_at: lead.lastActivityAt?.toISOString() ?? null,
    entered_care_pool_at: lead.enteredCarePoolAt?.toISOString() ?? null,
    care_pool_locked_by: lead.carePoolLockedBy
      ? {
          id: lead.carePoolLockedBy.id,
          name: lead.carePoolLockedBy.fullName,
          role: lead.carePoolLockedBy.role,
          avatar_url: lead.carePoolLockedBy.avatarUrl,
        }
      : null,
    is_duplicate_flagged: lead.isDuplicateFlagged,
    created_at: lead.createdAt.toISOString(),
    updated_at: lead.updatedAt.toISOString(),
  };
}

/** Cụm quan hệ dùng chung khi truy vấn Lead, khớp đúng shape trên. */
export const CANDIDATE_INCLUDE = {
  source: { select: { id: true, name: true } },
  uploadedBy: {
    select: { id: true, fullName: true, role: true, avatarUrl: true },
  },
  assignedTo: {
    select: { id: true, fullName: true, role: true, avatarUrl: true },
  },
  heldBy: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
  carePoolLockedBy: {
    select: { id: true, fullName: true, role: true, avatarUrl: true },
  },
  callStatus: { select: { id: true, name: true } },
  callResult: { select: { id: true, name: true } },
  zaloStatus: { select: { id: true, name: true } },
  zaloFriendStatus: { select: { id: true, name: true } },
  currentInterviewStatus: { select: { id: true, name: true } },
  currentEmploymentStatus: { select: { id: true, name: true } },
} as const;

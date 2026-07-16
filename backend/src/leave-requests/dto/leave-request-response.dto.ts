import {
  Account,
  AccountRole,
  LeaveDecision,
  LeaveRequest,
  LeaveRequestStatus,
} from '../../../generated/prisma/client';

/** Khớp NamedRefWithRole ở các module khác (candidates) — dùng chung shape cho mọi tài khoản tham chiếu. */
export interface LeaveRequestPersonDto {
  id: string;
  full_name: string;
  role: AccountRole;
  avatar_url: string | null;
}

/**
 * Đối tượng "Đơn xin nghỉ phép" — yêu cầu trực tiếp người dùng (2026-07-16).
 * `employee_position`/`employee_department` lấy LIVE từ Account.position/
 * team.name tại thời điểm xem (không snapshot) — khớp cách CandidateResponseDto
 * làm với uploaded_by/assigned_to (join trực tiếp, không lưu bản sao text).
 */
export interface LeaveRequestResponseDto {
  id: string;
  account: LeaveRequestPersonDto;
  employee_position: string | null;
  employee_department: string | null;
  recipient_text: string | null;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  handover_to: string | null;
  status: LeaveRequestStatus;
  leader_decision_by: LeaveRequestPersonDto | null;
  leader_decision_at: string | null;
  leader_decision: LeaveDecision | null;
  leader_note: string | null;
  admin_decision_by: LeaveRequestPersonDto | null;
  admin_decision_at: string | null;
  admin_decision: LeaveDecision | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

const ROLE_LABEL: Record<AccountRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  leader: 'Leader',
  mkt: 'NV MKT',
  sale: 'NV Sale',
  accounting: 'Kế toán',
  order_staff: 'NV QL Đơn hàng',
  shuttle_staff: 'NV Đưa đón',
};

function toPersonDto(
  account: Pick<Account, 'id' | 'fullName' | 'role' | 'avatarUrl'>,
): LeaveRequestPersonDto {
  return {
    id: account.id,
    full_name: account.fullName,
    role: account.role,
    avatar_url: account.avatarUrl,
  };
}

type LeaveRequestWithRelations = LeaveRequest & {
  account: Pick<
    Account,
    'id' | 'fullName' | 'role' | 'avatarUrl' | 'position'
  > & {
    team: { name: string } | null;
  };
  leaderDecisionBy?: Pick<
    Account,
    'id' | 'fullName' | 'role' | 'avatarUrl'
  > | null;
  adminDecisionBy?: Pick<
    Account,
    'id' | 'fullName' | 'role' | 'avatarUrl'
  > | null;
};

export function toLeaveRequestResponse(
  request: LeaveRequestWithRelations,
): LeaveRequestResponseDto {
  return {
    id: request.id,
    account: toPersonDto(request.account),
    employee_position:
      request.account.position ?? ROLE_LABEL[request.account.role],
    employee_department: request.account.team?.name ?? null,
    recipient_text: request.recipientText,
    start_date: request.startDate.toISOString().slice(0, 10),
    end_date: request.endDate.toISOString().slice(0, 10),
    days_count: request.daysCount,
    reason: request.reason,
    handover_to: request.handoverTo,
    status: request.status,
    leader_decision_by: request.leaderDecisionBy
      ? toPersonDto(request.leaderDecisionBy)
      : null,
    leader_decision_at: request.leaderDecisionAt?.toISOString() ?? null,
    leader_decision: request.leaderDecision,
    leader_note: request.leaderNote,
    admin_decision_by: request.adminDecisionBy
      ? toPersonDto(request.adminDecisionBy)
      : null,
    admin_decision_at: request.adminDecisionAt?.toISOString() ?? null,
    admin_decision: request.adminDecision,
    admin_note: request.adminNote,
    created_at: request.createdAt.toISOString(),
    updated_at: request.updatedAt.toISOString(),
  };
}

export const LEAVE_REQUEST_INCLUDE = {
  account: {
    select: {
      id: true,
      fullName: true,
      role: true,
      avatarUrl: true,
      position: true,
      team: { select: { name: true } },
    },
  },
  leaderDecisionBy: {
    select: { id: true, fullName: true, role: true, avatarUrl: true },
  },
  adminDecisionBy: {
    select: { id: true, fullName: true, role: true, avatarUrl: true },
  },
} as const;

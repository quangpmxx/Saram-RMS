import { Account, Team } from '../../../generated/prisma/client';

/** Đối tượng "Account" dùng chung — Mục 0.1, docs/13-api-design.md. Không bao giờ chứa mật khẩu. */
export interface AccountResponseDto {
  id: string;
  full_name: string;
  username: string;
  role: string;
  team_id: string | null;
  team_name: string | null;
  status: string;
  /** Dự án phụ — nâng cấp toàn diện: đường dẫn tương đối ảnh đại diện tự upload (vd "/uploads/avatars/xxx.jpg"), null nếu chưa có. */
  avatar_url: string | null;
  /**
   * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
   * docs/09-13, yêu cầu trực tiếp người dùng): 5 field hồ sơ nhân sự — CHỈ
   * Admin sửa được (PUT /account/:id), Nhân viên/Leader chỉ xem (GET /me
   * dùng chung DTO này, không giới hạn vai trò). "YYYY-MM-DD" cho 2 field
   * ngày.
   */
  date_of_birth: string | null;
  hire_date: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  remaining_leave_days: number | null;
  created_at: string;
  updated_at: string;
}

type AccountWithTeam = Account & { team?: Pick<Team, 'id' | 'name'> | null };

export function toAccountResponse(
  account: AccountWithTeam,
): AccountResponseDto {
  return {
    id: account.id,
    full_name: account.fullName,
    username: account.username,
    role: account.role,
    team_id: account.teamId,
    team_name: account.team?.name ?? null,
    status: account.status,
    avatar_url: account.avatarUrl,
    date_of_birth: account.dateOfBirth
      ? account.dateOfBirth.toISOString().slice(0, 10)
      : null,
    hire_date: account.hireDate
      ? account.hireDate.toISOString().slice(0, 10)
      : null,
    personal_phone: account.personalPhone,
    personal_email: account.personalEmail,
    remaining_leave_days: account.remainingLeaveDays,
    created_at: account.createdAt.toISOString(),
    updated_at: account.updatedAt.toISOString(),
  };
}

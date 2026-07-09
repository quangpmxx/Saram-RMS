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
    created_at: account.createdAt.toISOString(),
    updated_at: account.updatedAt.toISOString(),
  };
}

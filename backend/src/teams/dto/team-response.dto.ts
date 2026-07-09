import { Account, Team } from '../../../generated/prisma/client';

/** Đối tượng "Team" dùng chung — Mục 0.1, docs/13-api-design.md. */
export interface TeamResponseDto {
  id: string;
  name: string;
  leader_id: string | null;
  leader_name: string | null;
  member_count: number;
  created_at: string;
}

type TeamWithRelations = Team & {
  leader?: Pick<Account, 'id' | 'fullName'> | null;
  _count?: { members: number };
};

export function toTeamResponse(team: TeamWithRelations): TeamResponseDto {
  return {
    id: team.id,
    name: team.name,
    leader_id: team.leaderId,
    leader_name: team.leader?.fullName ?? null,
    member_count: team._count?.members ?? 0,
    created_at: team.createdAt.toISOString(),
  };
}

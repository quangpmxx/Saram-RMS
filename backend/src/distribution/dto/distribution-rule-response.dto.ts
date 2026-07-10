import {
  Account,
  DistributionMember,
  DistributionRule,
} from '../../../generated/prisma/client';

/**
 * Đối tượng "DistributionRule" — Mục 0.1, docs/13-api-design.md:
 * "id, team_id, is_active, last_assigned_position, members (danh sách
 * account id + name + thứ tự)". `id: null` khi nhóm CHƯA từng cấu hình
 * (chưa có dòng dữ liệu) — trả về mặc định thay vì 404 để màn hình Leader
 * hiện được ngay trạng thái "chưa cấu hình" mà không cần xử lý riêng.
 */
export interface DistributionRuleResponseDto {
  id: string | null;
  team_id: string;
  is_active: boolean;
  last_assigned_position: number;
  members: Array<{ account_id: string; name: string; order_index: number }>;
}

type RuleWithMembers = DistributionRule & {
  members: Array<
    DistributionMember & { account: Pick<Account, 'id' | 'fullName'> }
  >;
};

export function toDistributionRuleResponse(
  teamId: string,
  rule: RuleWithMembers | null,
): DistributionRuleResponseDto {
  if (!rule) {
    return {
      id: null,
      team_id: teamId,
      is_active: false,
      last_assigned_position: 0,
      members: [],
    };
  }

  return {
    id: rule.id,
    team_id: rule.teamId,
    is_active: rule.isActive,
    last_assigned_position: rule.lastAssignedPosition,
    members: [...rule.members]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((member) => ({
        account_id: member.accountId,
        name: member.account.fullName,
        order_index: member.orderIndex,
      })),
  };
}

export const DISTRIBUTION_RULE_INCLUDE = {
  members: {
    include: { account: { select: { id: true, fullName: true } } },
  },
} as const;

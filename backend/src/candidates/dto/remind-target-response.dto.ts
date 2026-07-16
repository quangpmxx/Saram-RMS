import { Account, AccountRole } from '../../../generated/prisma/client';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — GET /candidate/:id/remind-target:
 * danh sách thành viên (kể cả Leader) trong ĐÚNG nhóm đang phụ trách data này,
 * để Admin/Quản lý/Leader chọn 1 người nhắc xử lý. KHÔNG gồm chính người
 * đang xem (không tự nhắc chính mình).
 */
export interface RemindTargetResponseDto {
  id: string;
  full_name: string;
  role: AccountRole;
  avatar_url: string | null;
}

export function toRemindTargetResponse(
  account: Pick<Account, 'id' | 'fullName' | 'role' | 'avatarUrl'>,
): RemindTargetResponseDto {
  return {
    id: account.id,
    full_name: account.fullName,
    role: account.role,
    avatar_url: account.avatarUrl,
  };
}

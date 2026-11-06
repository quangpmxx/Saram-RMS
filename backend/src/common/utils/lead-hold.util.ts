import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Số đang được giữ (yêu cầu người dùng 2026-11-06): CHỈ người đang giữ mới
 * thao tác được (sửa, ghi chú, trạng thái, lịch, xoá, dừng chăm sóc...) —
 * mọi người khác, kể cả Leader/Quản lý/Admin, đều bị chặn; họ chỉ còn quyền
 * bỏ giữ số (xem CandidatesService.setHold).
 */
export function assertNotHeldByOther(
  lead: { isHeld: boolean; heldById: string | null },
  user: AuthenticatedUser,
): void {
  if (lead.isHeld && lead.heldById !== user.id) {
    throw new ForbiddenException(
      'Số này đang được người khác giữ — chỉ người giữ số mới thao tác được (bỏ giữ số trước nếu cần)',
    );
  }
}

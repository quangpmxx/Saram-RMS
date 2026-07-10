import { Lead } from '../../generated/prisma/client';

/**
 * Mục 10.1, docs/09: lead đang hiển thị trong cột chăm sóc nếu đã có
 * `entered_care_pool_at` VÀ chưa bị Admin gỡ (`removed_from_care_pool_at`
 * rỗng) — dùng chung giữa CandidatesService (phạm vi xem) và
 * LeadPipelineService (phạm vi sửa qua khóa xử lý).
 */
export function isVisibleInCarePool(lead: Lead): boolean {
  return lead.enteredCarePoolAt !== null && lead.removedFromCarePoolAt === null;
}

/**
 * Mục 4.3, tài liệu 10 (khuyến nghị bổ sung sau Design Review): nghiệp vụ
 * yêu cầu khóa tự giải phóng "ngay khi thoát ra giữa chừng" (Mục 4, tài liệu
 * 09), nhưng phụ thuộc client báo hiệu thành công — nếu mất kết nối/tắt
 * trình duyệt đột ngột, khóa có thể bị "treo" vĩnh viễn. Cơ chế dự phòng: 1
 * khóa quá hạn TTL này được xem như đã tự giải phóng, KHÔNG thay đổi hành
 * vi giải phóng chủ động (POST /care-pool/:id/release) đã chốt.
 */
export const CARE_POOL_LOCK_TTL_MINUTES = 15;

export function isLockActive(lead: Lead, now: Date = new Date()): boolean {
  if (!lead.carePoolLockedById || !lead.carePoolLockedAt) {
    return false;
  }
  const elapsedMs = now.getTime() - lead.carePoolLockedAt.getTime();
  return elapsedMs < CARE_POOL_LOCK_TTL_MINUTES * 60 * 1000;
}

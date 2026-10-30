/**
 * Sắp xếp khi bấm tiêu đề cột Ngày/STT (yêu cầu người dùng 2026-10-30):
 * mọi danh sách có phân trang nhận `sort` (cột) + `order` (asc/desc) và sắp
 * ở backend, để thứ tự đúng trên TOÀN BỘ data chứ không chỉ trong 1 trang.
 * `sort=stt` = thứ tự mặc định của danh sách; `order=desc` đảo ngược nó.
 */
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Đảo chiều sắp xếp: dùng khi `sort=stt&order=desc` (đảo thứ tự mặc định). */
export function flipOrder(order: SortOrder): SortOrder {
  return order === 'asc' ? 'desc' : 'asc';
}

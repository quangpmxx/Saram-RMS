import type { MouseEvent } from "react";

/** Phần tử tự xử lý click riêng — bấm vào đó không mở trang Chi tiết. */
const INTERACTIVE = "a, button, input, select, textarea, label, [role='button'], [role='checkbox'], [contenteditable='true']";

/**
 * Bấm vào bất kỳ chỗ nào trên hàng data lao động → mở trang Chi tiết (yêu cầu
 * người dùng 2026-10-29, áp dụng cả tab Tất cả và Chăm sóc). Bỏ qua khi:
 * - bấm trúng nút/ô chọn/link... trong hàng (chúng tự xử lý);
 * - click đến từ popup/modal render qua portal (React vẫn bubble sự kiện
 *   portal lên <tr> dù DOM không nằm trong hàng);
 * - người dùng đang bôi đen chữ (vd copy SĐT).
 */
export function shouldOpenRowDetail(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target as HTMLElement;
  if (!event.currentTarget.contains(target)) return false;
  if (target.closest(INTERACTIVE)) return false;
  if (window.getSelection()?.toString()) return false;
  return true;
}

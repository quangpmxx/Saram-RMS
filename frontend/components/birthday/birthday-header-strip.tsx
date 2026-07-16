"use client";

import { useBirthdayTheme } from "@/lib/birthday-theme-context";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16), Mục 3: "Thêm dải trang trí sinh
 * nhật nhẹ [ở header]... icon bóng bay, ngôi sao... Vẫn giữ logo, thông
 * báo, tài khoản và nút chức năng ở vị trí hiện tại. Không làm header cao
 * lên đáng kể." — toàn bộ absolute + pointer-events-none, KHÔNG chiếm chỗ
 * trong luồng flex của header nên không đẩy bất kỳ phần tử nào, không đổi
 * chiều cao header. Header cha đã là `position: sticky` (đủ điều kiện làm
 * containing block cho phần tử absolute con, không cần thêm `relative`).
 */
export function BirthdayHeaderStrip() {
  const { hasBirthdayToday, decorationsHidden } = useBirthdayTheme();
  if (!hasBirthdayToday || decorationsHidden) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-pink-400 via-accent-400 to-pink-400" />
      <span className="absolute top-1.5 left-[38%] text-sm opacity-60 select-none sm:text-base">✨</span>
      <span className="absolute top-1.5 left-[62%] text-sm opacity-60 select-none sm:text-base">🎈</span>
    </div>
  );
}

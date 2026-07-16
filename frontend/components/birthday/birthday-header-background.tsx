"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useBirthdayTheme } from "@/lib/birthday-theme-context";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16, bổ sung sau khi xem ảnh chụp
 * thực tế): không chỉ dải viền trên 3px (BirthdayHeaderStrip) mà cả THANH
 * HEADER (nền trắng chứa tiêu đề/nút Chấm công/chuông/tài khoản) cũng phải
 * chuyển màu hồng nhạt khi có sinh nhật hôm nay. Đổi trực tiếp className nền
 * thật của <header> (không phải lớp phủ overlay riêng) — tránh mọi rủi ro
 * thứ tự z-index/stacking, giống cách BirthdayLayoutBackground đã làm với
 * nền trang.
 */
export function BirthdayHeaderBackground({ children }: { children: ReactNode }) {
  const { hasBirthdayToday, decorationsHidden } = useBirthdayTheme();
  const active = hasBirthdayToday && !decorationsHidden;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur transition-colors duration-700",
        active ? "border-pink-200 bg-pink-50/90" : "border-slate-200 bg-white/95",
      )}
    >
      {children}
    </header>
  );
}

"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useBirthdayTheme } from "@/lib/birthday-theme-context";
import { BirthdayConfettiLayer } from "./birthday-confetti-layer";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16), Mục 2/3: "nền trang web... dùng
 * gradient rất nhẹ giữa xanh dương, cam, kem và trắng... không làm giảm độ
 * tương phản." THAY THẾ đúng vị trí <div className="flex min-h-screen
 * bg-slate-50 ..."> gốc ở layout.tsx bằng component client này — mọi phần
 * còn lại của layout (sidebar/header/main) không đổi, chỉ đổi CHỦ nền của
 * đúng 1 khối bọc ngoài cùng.
 */
export function BirthdayLayoutBackground({ children }: { children: ReactNode }) {
  const { hasBirthdayToday, decorationsHidden } = useBirthdayTheme();
  const active = hasBirthdayToday && !decorationsHidden;

  return (
    <div
      className={cn(
        "flex min-h-screen transition-colors duration-700 md:h-screen md:overflow-hidden",
        active ? "bg-gradient-to-br from-brand-50 via-orange-50/50 to-accent-50" : "bg-slate-50",
      )}
    >
      {active && <BirthdayConfettiLayer />}
      {children}
    </div>
  );
}

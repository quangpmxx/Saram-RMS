"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { cn } from "@/lib/cn";
import { useBirthdayTheme } from "@/lib/birthday-theme-context";

/**
 * UI Polish — sidebar thu gọn mặc định (chỉ icon, ~72px), mở rộng mượt khi
 * rê chuột vào (hiện đầy đủ logo/tên menu), tự thu gọn khi rời chuột. Nội
 * dung chính không bị che (sidebar là phần tử flex bình thường, mở rộng sẽ
 * đẩy nội dung chứ không đè lên).
 *
 * Mọi phần chữ (wordmark logo, tên menu trong SidebarNav, dòng chữ cuối)
 * đều tự kiểm soát việc ẩn/hiện bằng chính max-width/opacity của nó (ẩn
 * nhanh, hiện có độ trễ) — KHÔNG dựa vào overflow-hidden của thẻ <aside>
 * ngoài cùng, vì cắt qua overflow-hidden của cha dễ để lộ phần chữ bị cắt
 * dở khi đang chạy animation. <aside> vì vậy cũng KHÔNG đặt overflow-hidden
 * để tooltip tên menu (ở SidebarNav) có thể hiện ra ngoài sidebar khi thu gọn.
 */
export function CollapsibleSidebar({ navItems }: { navItems: NavItem[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Yêu cầu trực tiếp người dùng (2026-07-16), Mục 3: "Sidebar: giữ nguyên
  // toàn bộ menu và trạng thái đóng/mở... thêm họa tiết bóng bay/dây cờ nhỏ
  // ở phần trên/dưới... không cản thao tác hover/click." Gọi thẳng
  // useBirthdayTheme() ở đây (component này vốn đã "use client") thay vì
  // truyền prop từ layout.tsx (server component, không đọc được state
  // "đã ẩn trang trí" — chỉ tồn tại ở localStorage phía client).
  const { hasBirthdayToday, decorationsHidden } = useBirthdayTheme();
  const birthdayActive = hasBirthdayToday && !decorationsHidden;

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={cn(
        "relative z-20 hidden shrink-0 flex-col transition-[width,background] duration-300 ease-in-out md:flex",
        birthdayActive
          ? "bg-gradient-to-b from-pink-700 via-fuchsia-800 to-brand-950"
          : "bg-gradient-to-b from-brand-900 to-brand-950",
        isExpanded ? "md:w-64" : "md:w-[72px]",
      )}
    >
      {/* pointer-events-none + vẽ TRƯỚC nội dung thật trong DOM (menu/logo
          luôn nằm SAU nên tự nhiên đè lên trên, không cần z-index riêng) —
          chữ/icon menu không bao giờ bị che, thao tác hover/click không bị cản. */}
      {birthdayActive && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 flex justify-center gap-2 pt-1.5 text-sm opacity-50">
            <span>🎉</span>
            <span>🎈</span>
            <span>🎊</span>
          </div>
          <span className="birthday-balloon-float absolute right-2 bottom-16 text-lg opacity-40 select-none">🎈</span>
        </div>
      )}

      <div className="flex items-center px-[19px] py-5">
        <div
          className={cn(
            "overflow-hidden transition-[max-width]",
            isExpanded ? "max-w-[200px] duration-300" : "max-w-[34px] duration-200",
          )}
        >
          {/* w-max: giữ nguyên chiều rộng tự nhiên (icon + chữ) để wrapper ngoài
              clip đúng phần cần ẩn, không để flexbox ép co nhỏ icon lại. */}
          <Logo variant="light" size="sm" showWordmark href="/" className="w-max" />
        </div>
      </div>
      <div className="mt-2 flex-1">
        <SidebarNav items={navItems} collapsed={!isExpanded} />
      </div>
      <div
        className={cn(
          "overflow-hidden px-5 transition-[max-width,opacity]",
          isExpanded ? "max-w-[200px] py-4 opacity-100 delay-150 duration-200" : "max-w-0 py-4 opacity-0 duration-100",
        )}
      >
        <p className="text-xs whitespace-nowrap text-brand-200/50">Saram RMS · Nội bộ</p>
      </div>
    </aside>
  );
}

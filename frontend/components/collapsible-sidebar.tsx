"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { cn } from "@/lib/cn";

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

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={cn(
        "z-20 hidden shrink-0 flex-col bg-gradient-to-b from-brand-900 to-brand-950 transition-[width] duration-300 ease-in-out md:flex",
        isExpanded ? "md:w-64" : "md:w-[72px]",
      )}
    >
      <div className="flex items-center px-[19px] py-5">
        <div
          className={cn(
            "overflow-hidden transition-[max-width]",
            isExpanded ? "max-w-[200px] duration-300" : "max-w-[34px] duration-200",
          )}
        >
          {/* w-max: giữ nguyên chiều rộng tự nhiên (icon + chữ) để wrapper ngoài
              clip đúng phần cần ẩn, không để flexbox ép co nhỏ icon lại. */}
          <Logo variant="light" size="sm" showWordmark className="w-max" />
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

"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { cn } from "@/lib/cn";
import { useBirthdayTheme } from "@/lib/birthday-theme-context";

/**
 * UI Polish — sidebar thu gọn mặc định (chỉ icon, 64px), mở rộng mượt khi
 * rê chuột vào (hiện đầy đủ logo/tên menu), tự thu gọn khi rời chuột. Khi
 * mở, sidebar ĐÈ lên mép trái nội dung chứ không đẩy nội dung (2026-11-11,
 * cho hiệu ứng mượt ở trang có bảng lớn).
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

  // Chờ một nhịp rồi mới mở: rê chuột lướt ngang qua mép trái không làm
  // sidebar bật ra rồi thụt vào ngay.
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelOpen() {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
  }
  useEffect(() => cancelOpen, []);

  return (
    // <aside> chỉ giữ chỗ 64px cố định trong bố cục; khung thật bên trong
    // (absolute) mới đổi chiều rộng và ĐÈ lên nội dung khi mở — nội dung bên
    // phải không bị đẩy nên trình duyệt không phải tính lại bố cục cả trang
    // (bảng lớn) ở từng khung hình. z-[51]: trên header (z-50) để phần mở ra
    // không bị header che, dưới mọi popup (z-[55] trở lên).
    <aside className="relative z-[51] hidden w-16 shrink-0 md:block">
    <div
      onMouseEnter={() => {
        cancelOpen();
        openTimer.current = setTimeout(() => setIsExpanded(true), 120);
      }}
      onMouseLeave={() => {
        cancelOpen();
        setIsExpanded(false);
      }}
      className={cn(
        "absolute inset-y-0 left-0 flex flex-col transition-[width,box-shadow] duration-200 ease-out",
        birthdayActive
          ? "bg-gradient-to-b from-pink-700 via-fuchsia-800 to-brand-950"
          : "bg-gradient-to-b from-brand-900 to-brand-950",
        isExpanded ? "w-56 shadow-2xl" : "w-16",
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

      <div className="flex items-center px-[18px] py-3.5">
        <div
          className={cn(
            "overflow-hidden transition-[max-width]",
            isExpanded ? "max-w-[200px] duration-300" : "max-w-[28px] duration-200",
          )}
        >
          {/* w-max: giữ nguyên chiều rộng tự nhiên (icon + chữ) để wrapper ngoài
              clip đúng phần cần ẩn, không để flexbox ép co nhỏ icon lại. */}
          <Logo variant="light" size="xs" showWordmark slogan="Make Saram Great Again" href="/" className="w-max" />
        </div>
      </div>
      <div className="mt-1 flex-1">
        <SidebarNav items={navItems} collapsed={!isExpanded} />
      </div>
      <div
        className={cn(
          "overflow-hidden px-4 transition-[max-width,opacity]",
          isExpanded ? "max-w-[200px] py-3 opacity-100 delay-150 duration-200" : "max-w-0 py-3 opacity-0 duration-100",
        )}
      >
        <p className="text-[11px] whitespace-nowrap text-brand-200/50">Saram CRM · Nội bộ</p>
        <p className="text-[11px] whitespace-nowrap text-brand-200/50">©PMQ</p>
      </div>
    </div>
    </aside>
  );
}

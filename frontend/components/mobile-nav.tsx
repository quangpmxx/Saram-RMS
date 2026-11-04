"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";

/**
 * Điều hướng trên điện thoại (2026-11-04): thay hàng menu cuộn ngang dưới
 * header bằng nút ☰ mở menu trượt từ trái (đủ mọi mục như sidebar desktop).
 * Không dùng thanh tab ở đáy (user bỏ 2026-11-04). Chỉ hiện dưới md.
 */

function MobileDrawer({ navItems, onClose }: { navItems: NavItem[]; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    // z-[55]: trên header (z-50), dưới modal (z-[60]).
    <div className="fixed inset-0 z-[55] md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Đóng menu"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="mobile-drawer-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-gradient-to-b from-brand-900 to-brand-950 pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-4">
          <Logo variant="light" size="sm" showWordmark slogan="Make Saram Great Again" href="/" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-100 hover:bg-white/10"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {/* Bấm 1 mục → đóng menu (bắt sự kiện ở khối cha, không sửa SidebarNav). */}
        <div className="flex-1 pb-4" onClick={(event) => (event.target as HTMLElement).closest("a") && onClose()}>
          <SidebarNav items={navItems} />
        </div>
        <p className="px-5 pb-4 text-xs text-brand-200/50">Saram CRM · Nội bộ · ©PMQ</p>
      </aside>
    </div>,
    document.body,
  );
}

/** Nút ☰ trên header (chỉ điện thoại). */
export function MobileMenuButton({ navItems }: { navItems: NavItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Mở menu"
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
      >
        <Menu className="h-5 w-5" strokeWidth={2} />
      </button>
      {isOpen && <MobileDrawer navItems={navItems} onClose={() => setIsOpen(false)} />}
    </>
  );
}


"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { ACCOUNT_ROLE_LABEL, type Account } from "@/lib/types";
import { adminGoldTextStyle } from "@/lib/admin-gold";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

/**
 * Tinh chỉnh trang đăng nhập/khu vực tài khoản (dự án phụ — nâng cấp toàn
 * diện): gộp avatar + tên + vai trò thành 1 cụm mở dropdown ("bấm hoặc rê
 * chuột" — cả 2 cách đều mở được), thay cho nút "Đăng xuất" đứng riêng.
 * Dropdown gồm đúng 2 mục: Cài đặt tài khoản (chuyển trang /account-settings,
 * không mở popup — popup từng bị giới hạn chiều cao khó xem trên màn nhỏ),
 * Đăng xuất.
 */
export function UserMenu({ user }: { user: Account }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleMouseEnter() {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsOpen(true);
  }

  function handleMouseLeave() {
    closeTimeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await clientApi("/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-lg py-0.5 pr-1 pl-1.5 transition-colors hover:bg-slate-100"
      >
        {/* UI Polish — tinh chỉnh mật độ hiển thị: thu nhỏ font tên/chức vụ. */}
        <div className="hidden text-right text-xs leading-tight sm:block">
          <p className="font-medium text-slate-800">{user.full_name}</p>
          <p className="text-[11px] text-slate-500">
            <span style={adminGoldTextStyle(user.role)}>{ACCOUNT_ROLE_LABEL[user.role]}</span>
            {user.team_name ? ` · ${user.team_name}` : ""}
          </p>
        </div>
        {/* UI Polish — thu nhỏ avatar ~11% (h-9/w-9 mặc định → h-8/w-8). */}
        <Avatar fullName={user.full_name} avatarUrl={user.avatar_url} className="h-8 w-8" />
        <ChevronDown
          className={cn("hidden h-4 w-4 shrink-0 text-slate-400 transition-transform sm:block", isOpen && "rotate-180")}
          strokeWidth={2}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg shadow-slate-900/10"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              router.push("/account-settings");
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Settings className="h-4 w-4 text-slate-400" strokeWidth={2} />
            Cài đặt tài khoản
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { Avatar } from "@/components/ui/avatar";
import { useBirthdayTheme } from "@/lib/birthday-theme-context";

/**
 * Lời chúc sinh nhật — nằm GỌN trên header, cùng hàng với chuông thông báo
 * (yêu cầu người dùng 2026-11-02; trước đây là banner lớn ở đầu nội dung).
 * Đặt 1 LẦN trong layout dùng chung. KHÔNG hiển thị ngày/năm sinh/tuổi.
 */
export function BirthdayBanner() {
  const { employees, hasBirthdayToday, decorationsHidden, hideDecorationsToday, showDecorationsToday } = useBirthdayTheme();

  if (!hasBirthdayToday) return null;

  const names = employees.map((e) => e.full_name).join(", ");
  const text =
    employees.length >= 2
      ? `Chúc mừng sinh nhật ${employees.length} thành viên: ${names}!`
      : `Chúc mừng sinh nhật ${names}!`;
  const wish = "Chúc bạn một tuổi mới nhiều sức khỏe, niềm vui và thành công cùng Saram Vina.";

  return (
    <div
      title={`${text} ${wish}`}
      className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-full border border-pink-200/70 bg-gradient-to-r from-pink-50 via-orange-50 to-pink-50 py-0.5 pr-3 pl-2"
    >
      <span aria-hidden="true" className={`select-none text-xl ${decorationsHidden ? "" : "birthday-candle-glow"}`}>
        🎂
      </span>
      <div className="flex shrink-0 -space-x-1.5">
        {employees.slice(0, 3).map((e) => (
          <Avatar key={e.account_id} fullName={e.full_name} avatarUrl={e.avatar_url} className="h-6 w-6 text-[10px] ring-2 ring-white" />
        ))}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-xs font-bold text-rose-900 sm:text-sm">{text}</p>
        <p className="hidden truncate text-[11px] text-slate-600 xl:block">{wish}</p>
      </div>
      <button
        type="button"
        onClick={decorationsHidden ? showDecorationsToday : hideDecorationsToday}
        className="hidden shrink-0 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-600 lg:block"
      >
        {decorationsHidden ? "Hiện trang trí" : "Ẩn trang trí"}
      </button>
    </div>
  );
}

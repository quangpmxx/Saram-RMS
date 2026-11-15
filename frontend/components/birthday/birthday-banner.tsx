"use client";

import { Avatar } from "@/components/ui/avatar";
import { useBirthdayTheme } from "@/lib/birthday-theme-context";

/**
 * Lời chúc sinh nhật — nằm GỌN trên header, cùng hàng với chuông thông báo
 * (yêu cầu người dùng 2026-11-02; trước đây là banner lớn ở đầu nội dung).
 * Đặt 1 LẦN trong layout dùng chung. KHÔNG hiển thị ngày/năm sinh/tuổi.
 */
export function BirthdayBanner({ currentAccountId }: { currentAccountId: string }) {
  const { employees, hasBirthdayToday, decorationsHidden, hideDecorationsToday, showDecorationsToday } = useBirthdayTheme();

  if (!hasBirthdayToday) return null;

  const names = employees.map((e) => e.full_name).join(", ");
  // Người có sinh nhật: giữ lời chúc cũ. Tài khoản khác: lời nhắc gửi lời chúc (yêu cầu user 2026-11-15).
  const isBirthdayPerson = employees.some((e) => e.account_id === currentAccountId);
  const givenNames = employees.map((e) => e.full_name.trim().split(/\s+/).pop() ?? e.full_name);
  const text = isBirthdayPerson
    ? employees.length >= 2
      ? `Chúc mừng sinh nhật ${employees.length} thành viên: ${names}!`
      : `Chúc mừng sinh nhật ${names}!`
    : `Hôm nay là sinh nhật ${names}`;
  // "Linh", "Linh và Hoa", "Linh, Hoa và Mai"
  const givenList =
    givenNames.length <= 2 ? givenNames.join(" và ") : `${givenNames.slice(0, -1).join(", ")} và ${givenNames.at(-1)}`;
  const wish = isBirthdayPerson
    ? "Chúc bạn một tuổi mới nhiều sức khỏe, niềm vui và thành công cùng Saram Vina."
    : `Hãy dành những lời chúc tốt đẹp nhất dành cho ${givenList} nhé!`;

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
        <p className="truncate text-xs font-bold text-[#881337] sm:text-sm">{text}</p>
        <p className="hidden truncate text-[11px] text-[#475569] xl:block">{wish}</p>
      </div>
      <button
        type="button"
        onClick={decorationsHidden ? showDecorationsToday : hideDecorationsToday}
        className="hidden shrink-0 text-[11px] font-medium text-[#94a3b8] transition-colors hover:text-[#475569] lg:block"
      >
        {decorationsHidden ? "Hiện trang trí" : "Ẩn trang trí"}
      </button>
    </div>
  );
}

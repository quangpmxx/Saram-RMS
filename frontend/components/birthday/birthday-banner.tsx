"use client";

import { Avatar } from "@/components/ui/avatar";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import { useBirthdayTheme } from "@/lib/birthday-theme-context";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16), Mục 3/4/9: banner sinh nhật ở
 * đầu nội dung — đặt 1 LẦN trong layout dùng chung (app/(dashboard)/layout.tsx),
 * KHÔNG chèn riêng vào từng trang. Mục 6: KHÔNG hiển thị ngày sinh/năm
 * sinh/tuổi — chỉ tên, avatar, nhóm/chức vụ (dữ liệu này backend đã tự lọc
 * sẵn, xem BirthdayEmployee ở lib/types.ts).
 */
export function BirthdayBanner() {
  const { employees, hasBirthdayToday, decorationsHidden, hideDecorationsToday, showDecorationsToday } = useBirthdayTheme();

  if (!hasBirthdayToday) return null;

  const isMultiple = employees.length >= 2;
  const first = employees[0];

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-pink-200/70 bg-gradient-to-r from-pink-50 via-orange-50 to-pink-50 p-4 shadow-md shadow-pink-900/5 sm:p-5">
      {/* Mục 8: "Vẫn giữ banner lời chúc gọn" khi đã ẩn trang trí — bỏ hẳn hoạt họa (nến/bóng bay) trong banner, chỉ còn nội dung lời chúc. */}
      {!decorationsHidden && (
        <>
          <span
            aria-hidden="true"
            className="birthday-candle-glow pointer-events-none absolute top-3 right-16 text-2xl select-none sm:text-3xl"
          >
            🕯️
          </span>
          <span aria-hidden="true" className="pointer-events-none absolute -top-2 right-4 text-3xl select-none sm:text-4xl">
            🎈
          </span>
        </>
      )}

      <div className="flex flex-wrap items-center gap-4 pr-6">
        <span aria-hidden="true" className="text-4xl select-none sm:text-5xl">
          🎂
        </span>
        <div className="min-w-0 flex-1">
          {isMultiple ? (
            <>
              <h2 className="text-base font-bold text-rose-900 sm:text-lg">
                Chúc mừng sinh nhật {employees.length} thành viên Saram Vina!
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Chúc các bạn một tuổi mới nhiều sức khỏe, niềm vui và thành công cùng Saram Vina.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {employees.map((employee) => (
                  <div
                    key={employee.account_id}
                    className="flex shrink-0 items-center gap-2 rounded-full bg-white/70 py-1 pr-3 pl-1 ring-1 ring-inset ring-pink-200"
                  >
                    <Avatar fullName={employee.full_name} avatarUrl={employee.avatar_url} className="h-7 w-7 text-xs" />
                    <span className="text-xs font-medium text-slate-700">{employee.full_name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Avatar fullName={first.full_name} avatarUrl={first.avatar_url} className="h-11 w-11 text-sm" />
                <div>
                  <h2 className="text-base font-bold text-rose-900 sm:text-lg">Chúc mừng sinh nhật {first.full_name}!</h2>
                  <p className="text-xs text-slate-500">
                    {first.position ?? ACCOUNT_ROLE_LABEL[first.role]}
                    {first.team_name ? ` · ${first.team_name}` : ""}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">Chúc bạn một tuổi mới nhiều sức khỏe, niềm vui và thành công cùng Saram Vina.</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-end border-t border-pink-200/70 pt-2">
        {decorationsHidden ? (
          <button
            type="button"
            onClick={showDecorationsToday}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            Hiện trang trí
          </button>
        ) : (
          <button
            type="button"
            onClick={hideDecorationsToday}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            Ẩn trang trí hôm nay
          </button>
        )}
      </div>
    </div>
  );
}

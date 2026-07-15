"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Fingerprint } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import type { CheckinStatus } from "@/lib/types";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): nút "Chấm công" trên header —
 * "Check in GPS" PHASE 1 (triển khai theo 4 Phase, yêu cầu trực tiếp người
 * dùng). Gọi GET /checkin/status khi mount để biết đã Check in hôm nay
 * chưa (Mục 1: "sau khi Check in thành công, đổi thành 'Đã chấm công hôm
 * nay' và disable"). Chỉ hiện với tài khoản không phải Admin/Quản lý (xem
 * layout.tsx — nơi gọi component này, đúng khớp CHECKIN_ROLES ở backend).
 * Bấm vào điều hướng sang /attendance/checkin (CÙNG tab — khác với nút
 * "Check in" khung sườn ở toolbar Chấm công thủ công vốn mở tab mới).
 */
export function ClockInButton() {
  const router = useRouter();
  const [status, setStatus] = useState<CheckinStatus | null>(null);

  const refetch = useCallback(() => {
    clientApi<CheckinStatus>("/checkin/status")
      .then(setStatus)
      .catch(() => {
        // Lỗi tra cứu trạng thái không nên chặn hiển thị nút — cứ để mặc
        // định "chưa check-in", bấm vào trang Check in sẽ tự báo lỗi thật.
      });
  }, []);

  useEffect(() => {
    refetch();
    function onFocus() {
      refetch();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refetch]);

  const checkedIn = status?.checked_in_today ?? false;

  if (checkedIn) {
    return (
      <button
        type="button"
        disabled
        title="Đã chấm công hôm nay"
        className="flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-xs font-medium text-emerald-700 shadow-sm"
      >
        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
        <span className="hidden sm:inline">Đã chấm công hôm nay</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      title="Chấm công"
      onClick={() => router.push("/attendance/checkin")}
      className="flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-3 text-xs font-medium text-white shadow-sm shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-600/30 active:translate-y-0"
    >
      <Fingerprint className="h-4 w-4" strokeWidth={2} />
      <span className="hidden sm:inline">Chấm công</span>
    </button>
  );
}

"use client";

import { useSetPageTitle } from "@/lib/page-title-context";

/**
 * Khung sườn module Marketing Hub — CHƯA có nghiệp vụ gì (yêu cầu trực tiếp người
 * dùng), chỉ trang báo "sắp ra mắt". Không tự phát minh nghiệp vụ/DB/API cho module này.
 */
export function MarketingHubClient() {
  useSetPageTitle("Marketing Hub", "Nghiệp vụ marketing sẽ sớm được ra mắt.");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <p className="text-lg font-medium text-slate-700">Nghiệp vụ marketing sẽ sớm được ra mắt</p>
    </div>
  );
}

"use client";

import { useSetPageTitle } from "@/lib/page-title-context";

/**
 * Dự án phụ — nâng cấp toàn diện: khung sườn module Quản lý đơn hàng — CHƯA
 * có nghiệp vụ gì (yêu cầu trực tiếp người dùng), chỉ trang trắng báo "sắp ra
 * mắt". Không tự phát minh nghiệp vụ/DB/API cho module này.
 */
export function OrderManagementClient() {
  useSetPageTitle("Quản lý đơn hàng", "Nghiệp vụ quản lý đơn hàng sẽ sớm được ra mắt.");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <p className="text-lg font-medium text-slate-700">Nghiệp vụ quản lý đơn hàng sẽ sớm được ra mắt</p>
      <p className="text-sm text-slate-400">-Phạm Minh Quang-</p>
    </div>
  );
}

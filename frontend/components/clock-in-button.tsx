"use client";

import { Fingerprint } from "lucide-react";
import { useToast } from "@/lib/toast-context";

/**
 * Dự án phụ — nâng cấp toàn diện: nút "Chấm công" trên header — CHỈ hiện
 * placeholder giao diện (yêu cầu trực tiếp người dùng: "về sau anh sẽ gán
 * tính năng cho nó sau"), chưa gắn nghiệp vụ/API thật. Đặt cạnh trái quả
 * chuông thông báo, chỉ hiện với tài khoản không phải Admin/Quản lý (Mục
 * 3, xem layout.tsx — nơi gọi component này).
 */
export function ClockInButton() {
  const toast = useToast();

  return (
    <button
      type="button"
      title="Chấm công"
      onClick={() => toast.warning("Tính năng chấm công sẽ sớm ra mắt")}
      className="flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-3 text-xs font-medium text-white shadow-sm shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-600/30 active:translate-y-0"
    >
      <Fingerprint className="h-4 w-4" strokeWidth={2} />
      <span className="hidden sm:inline">Chấm công</span>
    </button>
  );
}

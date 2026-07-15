import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AccountingClient } from "./accounting-client";

/**
 * Dự án phụ — nâng cấp toàn diện: module Kế toán — CHỈ khung sườn, chưa có
 * nghiệp vụ gì (yêu cầu trực tiếp người dùng, 2026-07-14). Tạm giới hạn chỉ
 * Admin xem được ("hiện tại thì để nó ở tài khoản admin thôi đã") — khớp
 * đúng danh sách roles của mục nav "/accounting" ở layout.tsx.
 */
export default async function AccountingPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <AccountingClient />;
}

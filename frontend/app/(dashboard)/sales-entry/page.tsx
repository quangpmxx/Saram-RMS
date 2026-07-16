import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SalesEntryClient } from "./sales-entry-client";

/**
 * Dự án phụ — nâng cấp toàn diện: module Nhập doanh số — CHỈ khung sườn,
 * chưa có nghiệp vụ gì (yêu cầu trực tiếp người dùng, 2026-07-16, "giống như
 * kế toán ấy"). Tạm giới hạn chỉ Admin xem được, khớp đúng danh sách roles
 * của mục nav "/sales-entry" ở layout.tsx.
 */
export default async function SalesEntryPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <SalesEntryClient />;
}

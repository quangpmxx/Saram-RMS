import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { requirePageAccess } from "@/lib/module-permission";
import { AccountingClient } from "./accounting-client";

/**
 * Dự án phụ — nâng cấp toàn diện: module Kế toán — CHỈ khung sườn, chưa có
 * nghiệp vụ gì (yêu cầu trực tiếp người dùng, 2026-07-14). Mặc định chỉ
 * Admin xem được (defaultRoles ['admin'] ở module-registry.ts).
 */
export default async function AccountingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  await requirePageAccess("accounting");

  return <AccountingClient />;
}

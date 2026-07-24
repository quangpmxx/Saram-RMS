import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { requirePageAccess } from "@/lib/module-permission";
import { OrderManagementClient } from "./order-management-client";

/**
 * Dự án phụ — nâng cấp toàn diện: module Quản lý đơn hàng — CHỈ khung sườn,
 * chưa có nghiệp vụ gì (yêu cầu trực tiếp người dùng, 2026-07-16, "giống như
 * kế toán ấy"). Mặc định chỉ Admin xem được (defaultRoles ['admin'] ở
 * module-registry.ts).
 */
export default async function OrderManagementPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  await requirePageAccess("order-management");

  return <OrderManagementClient />;
}

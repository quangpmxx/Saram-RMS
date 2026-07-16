import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { OrderManagementClient } from "./order-management-client";

/**
 * Dự án phụ — nâng cấp toàn diện: module Quản lý đơn hàng — CHỈ khung sườn,
 * chưa có nghiệp vụ gì (yêu cầu trực tiếp người dùng, 2026-07-16, "giống như
 * kế toán ấy"). Tạm giới hạn chỉ Admin xem được, khớp đúng danh sách roles
 * của mục nav "/order-management" ở layout.tsx.
 */
export default async function OrderManagementPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <OrderManagementClient />;
}

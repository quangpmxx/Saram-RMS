import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import type { OrderRecord } from "@/lib/types";
import { OrderManagementClient } from "./order-management-client";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-26, yêu cầu trực tiếp người dùng):
 * module Quản lý đơn hàng — danh sách tên đơn hàng, thêm/xóa được, mỗi tên
 * chọn màu nền/màu chữ riêng (giống hệt cơ chế màu của trang Đưa đón lao
 * động). Mặc định chỉ Admin xem/dùng được (defaultRoles ['admin'] ở
 * module-registry.ts, chặn cả 2 tầng frontend lẫn backend).
 */
export default async function OrderManagementPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const permissionLevel = await requirePageAccess("order-management");

  const initialRecords = await serverApi<OrderRecord[]>("/order-management");

  return <OrderManagementClient permissionLevel={permissionLevel} initialRecords={initialRecords} />;
}

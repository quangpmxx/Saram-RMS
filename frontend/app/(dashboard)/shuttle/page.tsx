import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import type { AccountOptionItem, PaginatedResult, ShuttleOptionItem, ShuttleOptions, ShuttleRecord } from "@/lib/types";
import { ShuttleClient } from "./shuttle-client";

/**
 * Dự án phụ — nâng cấp toàn diện: "Danh sách đưa đón" — module ĐỘC LẬP, nhập
 * tay tự do, thay thế Google Sheet đang dùng. Mọi vai trò đã đăng nhập đều
 * được xem/thêm/sửa/xóa (yêu cầu trực tiếp người dùng) — không lọc theo role
 * ở đây, chỉ chặn khi chưa đăng nhập.
 */
export default async function ShuttlePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const permissionLevel = await requirePageAccess("shuttle");

  const [listResult, options, saleAccounts, driverAccounts, companies] = await Promise.all([
    serverApi<PaginatedResult<ShuttleRecord>>("/shuttle?page=1&page_size=20"),
    serverApi<ShuttleOptions>("/shuttle/options"),
    serverApi<AccountOptionItem[]>("/shuttle/sale-accounts"),
    // Bổ sung 2026-07-28 (yêu cầu trực tiếp người dùng: "chuyển cả 2 cột
    // sang liên kết tài khoản thật") — nguồn gợi ý cột "Đưa đón" (role='shuttle_staff').
    serverApi<AccountOptionItem[]>("/shuttle/driver-accounts"),
    // Yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng"
    // — nguồn gợi ý cột "Công ty" giờ đọc từ OrderRecord (module Quản lý
    // đơn hàng), không còn quản lý riêng qua /shuttle/options nữa.
    serverApi<ShuttleOptionItem[]>("/shuttle/companies"),
  ]);

  return (
    <ShuttleClient
      permissionLevel={permissionLevel}
      initialResult={listResult}
      initialOptions={options}
      initialSaleAccounts={saleAccounts}
      initialDriverAccounts={driverAccounts}
      initialCompanies={companies}
    />
  );
}

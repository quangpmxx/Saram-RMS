import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { PaginatedResult, SaleAccountItem, ShuttleOptions, ShuttleRecord } from "@/lib/types";
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

  const [listResult, options, saleAccounts] = await Promise.all([
    serverApi<PaginatedResult<ShuttleRecord>>("/shuttle?page=1&page_size=20"),
    serverApi<ShuttleOptions>("/shuttle/options"),
    serverApi<SaleAccountItem[]>("/shuttle/sale-accounts"),
  ]);

  return <ShuttleClient initialResult={listResult} initialOptions={options} initialSaleAccounts={saleAccounts} />;
}

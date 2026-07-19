import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { DsSaleAccountOption, DsSaleCompanyOption, DsSaleRow, PaginatedResult } from "@/lib/types";
import { SalesEntryClient } from "./sales-entry-client";

const DEFAULT_PAGE_SIZE = 100;

/**
 * Dự án phụ — nâng cấp toàn diện: module Nhập doanh số. Tạm giới hạn chỉ
 * Admin xem được, khớp đúng danh sách roles của mục nav "/sales-entry" ở
 * layout.tsx.
 *
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, "DS Sale"): tải TRƯỚC dữ liệu
 * trang 1 + 3 nguồn dropdown ở SERVER (cùng lúc với getCurrentUser(), khớp
 * đúng khuôn mẫu shuttle/attendance/candidates) — tránh 1 vòng fetch client
 * thừa lúc mount và tránh setState-trong-effect (react-hooks/set-state-in-effect).
 */
export default async function SalesEntryPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const [initialRows, saleAccounts, pickupAccounts, companies] = await Promise.all([
    serverApi<PaginatedResult<DsSaleRow>>(`/sales-entry/ds-sale?page=1&page_size=${DEFAULT_PAGE_SIZE}`),
    serverApi<DsSaleAccountOption[]>("/sales-entry/ds-sale/sale-accounts"),
    serverApi<DsSaleAccountOption[]>("/sales-entry/ds-sale/pickup-accounts"),
    serverApi<DsSaleCompanyOption[]>("/sales-entry/ds-sale/companies"),
  ]);

  return (
    <SalesEntryClient
      currentUserId={user.id}
      initialRows={initialRows}
      initialSaleAccounts={saleAccounts}
      initialPickupAccounts={pickupAccounts}
      initialCompanies={companies}
    />
  );
}

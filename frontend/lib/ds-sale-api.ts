import { clientApi } from "./api-client";
import type { DsSaleAccountOption, DsSaleCompanyOption, DsSaleRow, DsSaleRowInput, PaginatedResult } from "./types";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, yêu cầu trực tiếp người
 * dùng): lớp gọi API riêng cho "DS Sale" (module con của "Nhập doanh số") —
 * TÁCH RIÊNG khỏi component UI để không hard-code danh sách công ty/Sale/
 * Đưa đón trực tiếp vào component (Mục 4/5/6). Khi module "Công ty hợp
 * tác" (Quản lý đơn hàng) có dữ liệu thật, CHỈ cần đổi phần thân
 * listDsSaleCompanies() sang gọi đúng endpoint mới — không đổi gì ở
 * component hay các hàm khác trong file này.
 */

export interface ListDsSaleParams {
  page: number;
  page_size: number;
  keyword?: string;
  join_date_from?: string;
  join_date_to?: string;
  company_id?: string;
  sale_user_id?: string;
  pickup_user_id?: string;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listDsSaleRows(params: ListDsSaleParams): Promise<PaginatedResult<DsSaleRow>> {
  return clientApi<PaginatedResult<DsSaleRow>>(`/sales-entry/ds-sale${toQueryString({ ...params })}`);
}

export function createDsSaleRow(input: DsSaleRowInput): Promise<DsSaleRow> {
  return clientApi<DsSaleRow>("/sales-entry/ds-sale", { method: "POST", body: JSON.stringify(input) });
}

export function updateDsSaleRow(id: string, input: DsSaleRowInput): Promise<DsSaleRow> {
  return clientApi<DsSaleRow>(`/sales-entry/ds-sale/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteDsSaleRows(ids: string[]): Promise<{ deleted: number }> {
  return clientApi<{ deleted: number }>("/sales-entry/ds-sale", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}

/** Mục 5: nguồn Sale = tài khoản role 'sale' đang active. */
export function listDsSaleAccounts(): Promise<DsSaleAccountOption[]> {
  return clientApi<DsSaleAccountOption[]>("/sales-entry/ds-sale/sale-accounts");
}

/** Mục 6: nguồn Đưa đón = tài khoản role 'shuttle_staff' đang active. */
export function listDsPickupAccounts(): Promise<DsSaleAccountOption[]> {
  return clientApi<DsSaleAccountOption[]>("/sales-entry/ds-sale/pickup-accounts");
}

/**
 * Mục 4: hiện trả về mảng rỗng (chưa có bảng công ty hợp tác thật) — frontend
 * tự hiện "Chưa có dữ liệu công ty hợp tác" khi mảng rỗng, KHÔNG coi là lỗi.
 */
export function listDsSaleCompanies(): Promise<DsSaleCompanyOption[]> {
  return clientApi<DsSaleCompanyOption[]>("/sales-entry/ds-sale/companies");
}

export function buildDsSaleExportUrl(params: Omit<ListDsSaleParams, "page" | "page_size">): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return `${base}/sales-entry/ds-sale/export${toQueryString({ ...params })}`;
}

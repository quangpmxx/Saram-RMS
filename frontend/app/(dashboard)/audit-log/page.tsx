import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import type { AuditLogEntry, Account, PaginatedResult } from "@/lib/types";
import { AuditLogClient } from "./audit-log-client";

/**
 * Phase 9 (docs/14-roadmap.md) — S14: "Màn hình Lịch sử/Nhật ký truy cập đầy
 * đủ cho Admin/Quản lý" (Mục 9.3, docs/12), dựa trên dữ liệu đã ghi từ
 * Phase 0. GET /audit-log: Admin, Quản lý (Mục 9, docs/13).
 *
 * Bộ lọc "theo tài khoản" chỉ hiện với Admin — GET /account (nguồn dữ liệu
 * để dựng dropdown chọn tài khoản) chỉ Admin gọi được (Mục 2, docs/13);
 * Quản lý không có cách nào khác để lấy toàn bộ danh sách tài khoản nên
 * KHÔNG hiện bộ lọc này cho Quản lý, thay vì tự mở rộng quyền GET /account
 * (giữ nguyên toàn bộ phân quyền, không tự suy đoán).
 */
export default async function AuditLogPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  // Nhật ký không có thao tác thêm/sửa/xóa nào (chỉ xem + lọc) — chỉ cần
  // chặn truy cập khi "none", không cần phân biệt view/edit ở giao diện.
  await requirePageAccess("audit-log");

  const canPickAccount = user.role === "admin";

  const [logs, accountsResult] = await Promise.all([
    serverApi<PaginatedResult<AuditLogEntry>>("/audit-log?page=1&page_size=20"),
    canPickAccount
      ? serverApi<PaginatedResult<Account>>("/account?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Account>>({ total: 0, page: 1, page_size: 100, items: [] }),
  ]);

  return (
    <AuditLogClient
      initialLogs={logs}
      canPickAccount={canPickAccount}
      accounts={accountsResult.items}
    />
  );
}

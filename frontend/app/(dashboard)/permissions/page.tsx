import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { Account, ModulePermissionSummary, PaginatedResult } from "@/lib/types";
import { PermissionsClient } from "./permissions-client";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): trang "Phân quyền" — CHỈ Admin truy cập được. Gate CỨNG theo role
 * (không đi qua requirePageAccess()/module-registry.ts) vì đây CHÍNH LÀ
 * công cụ quản trị hệ thống phân quyền — để nó tự phụ thuộc vào chính hệ
 * thống nó quản lý sẽ tạo nguy cơ khóa nhầm chính Admin ra khỏi công cụ
 * sửa quyền (vd nếu có bug khiến "accounts"/"settings" bị set nhầm).
 */
export default async function PermissionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/access-denied");
  }

  const [accountsResult, modules] = await Promise.all([
    serverApi<PaginatedResult<Account>>("/account?page=1&page_size=200"),
    serverApi<ModulePermissionSummary[]>("/module-permission/modules"),
  ]);

  return <PermissionsClient accounts={accountsResult.items} modules={modules} currentAdminId={user.id} />;
}

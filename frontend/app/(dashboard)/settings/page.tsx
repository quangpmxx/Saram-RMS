import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import type { Account, PaginatedResult, SystemConfig } from "@/lib/types";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  // Mục 9, docs/13-api-design.md — mặc định chỉ Admin (defaultRoles
  // ['admin'] ở module-registry.ts), Admin có thể mở rộng riêng qua trang
  // "Phân quyền".
  const permissionLevel = await requirePageAccess("settings");

  // Danh sách tài khoản cho panel "Xem thử giao diện sinh nhật" (Mục 11,
  // yêu cầu trực tiếp người dùng 2026-07-16) — tận dụng lại /account đã có,
  // không tạo endpoint riêng.
  const [configs, accountsResult] = await Promise.all([
    serverApi<SystemConfig[]>("/config"),
    serverApi<PaginatedResult<Account>>("/account?page=1&page_size=100"),
  ]);

  return <SettingsClient permissionLevel={permissionLevel} initialConfigs={configs} accounts={accountsResult.items} />;
}

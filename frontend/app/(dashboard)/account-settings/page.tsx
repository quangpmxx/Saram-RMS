import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { Account, PaginatedResult } from "@/lib/types";
import { AccountSettingsClient } from "./account-settings-client";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Danh sách tài khoản cho panel "Xem thử giao diện sinh nhật" (chỉ Admin,
  // dời từ trang Cấu hình vận hành sang đây — yêu cầu trực tiếp người dùng
  // 2026-07-24) — tận dụng lại /account đã có, không tạo endpoint riêng.
  const accounts =
    user.role === "admin"
      ? (await serverApi<PaginatedResult<Account>>("/account?page=1&page_size=100")).items
      : [];

  return <AccountSettingsClient user={user} accounts={accounts} />;
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import type { Account, PaginatedResult, Team } from "@/lib/types";
import { AccountsClient } from "./accounts-client";
import { AccountTabs } from "./account-tabs";

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  // Mục 9.1, docs/12-ui-design.md — mặc định chỉ Admin quản lý tài khoản
  // (defaultRoles ['admin'] ở module-registry.ts), Admin có thể mở rộng
  // riêng từng tài khoản qua trang "Phân quyền".
  const permissionLevel = await requirePageAccess("accounts");

  const [accountsResult, teamsResult] = await Promise.all([
    serverApi<PaginatedResult<Account>>("/account?page=1&page_size=100"),
    serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100"),
  ]);

  return (
    <>
      <AccountTabs active="accounts" isAdmin={user.role === "admin"} />
      <AccountsClient
        currentUserId={user.id}
        isAdmin={user.role === "admin"}
        permissionLevel={permissionLevel}
        initialAccounts={accountsResult.items}
        teams={teamsResult.items}
      />
    </>
  );
}

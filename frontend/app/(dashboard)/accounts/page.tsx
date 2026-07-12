import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { Account, PaginatedResult, Team } from "@/lib/types";
import { AccountsClient } from "./accounts-client";

export default async function AccountsPage() {
  const user = await getCurrentUser();

  // Mục 9.1, docs/12-ui-design.md — chỉ Admin quản lý tài khoản.
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const [accountsResult, teamsResult] = await Promise.all([
    serverApi<PaginatedResult<Account>>("/account?page=1&page_size=100"),
    serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100"),
  ]);

  return <AccountsClient initialAccounts={accountsResult.items} teams={teamsResult.items} />;
}

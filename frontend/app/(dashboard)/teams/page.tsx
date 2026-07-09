import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { Account, PaginatedResult, Team } from "@/lib/types";
import { TeamsClient } from "./teams-client";

export default async function TeamsPage() {
  const user = await getCurrentUser();

  // Mục 9.0, docs/12-ui-design.md — chỉ Admin quản lý nhóm.
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const [teamsResult, leadersResult] = await Promise.all([
    serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100"),
    serverApi<PaginatedResult<Account>>("/account?page=1&page_size=100&role=leader"),
  ]);

  return <TeamsClient initialTeams={teamsResult.items} leaders={leadersResult.items} />;
}

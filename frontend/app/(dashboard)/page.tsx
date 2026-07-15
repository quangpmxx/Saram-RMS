import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { DashboardSummary, LeadSource, PaginatedResult, SalePerformance, Team, TeamSummary } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

/**
 * Phase 7 (docs/14-roadmap.md) — thay thế trang "Trang chủ" tạm thời (link
 * nhanh + vài con số) bằng Dashboard thật theo Mục 1, docs/12 + Mục 9,
 * docs/09. Quyền xem GET /dashboard/summary: tất cả vai trò (Mục 8,
 * docs/13); performance = Leader/Quản lý/Admin; by-team = Quản lý/Admin.
 * Mặc định khoảng thời gian "Tháng này" (1 trong 4 preset đã chốt: Hôm nay/
 * Tuần này/Tháng này/Tùy chọn — tài liệu không quy định preset mặc định).
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canViewPerformance = ["admin", "manager", "leader"].includes(user.role);
  const canViewByTeam = ["admin", "manager"].includes(user.role);
  const canFilterByTeam = ["admin", "manager"].includes(user.role);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
  const dateQuery = new URLSearchParams({
    date_from: startOfMonth.toISOString(),
    date_to: endOfToday.toISOString(),
  });

  const [summary, performance, byTeam, teamsResult, sources] = await Promise.all([
    serverApi<DashboardSummary>(`/dashboard/summary?${dateQuery.toString()}`),
    canViewPerformance
      ? serverApi<SalePerformance[]>(`/dashboard/performance?${dateQuery.toString()}`)
      : Promise.resolve<SalePerformance[]>([]),
    canViewByTeam
      ? serverApi<TeamSummary[]>(`/dashboard/by-team?${dateQuery.toString()}`)
      : Promise.resolve<TeamSummary[]>([]),
    canFilterByTeam
      ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
    serverApi<LeadSource[]>("/lead-source"),
  ]);

  return (
    <DashboardClient
      currentUserFullName={user.full_name}
      currentUserRole={user.role}
      canViewPerformance={canViewPerformance}
      canViewByTeam={canViewByTeam}
      canFilterByTeam={canFilterByTeam}
      teams={teamsResult.items}
      sources={sources}
      initialSummary={summary}
      initialPerformance={performance}
      initialByTeam={byTeam}
    />
  );
}

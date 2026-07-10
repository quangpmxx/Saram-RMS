import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { BySourceReport, FunnelStep, LeadSource, PaginatedResult, Team, TeamMember } from "@/lib/types";
import { ReportsClient } from "./reports-client";

/**
 * Phase 7 (docs/14-roadmap.md) — trang Báo cáo mới, đúng Mục 8, docs/12:
 * "phần mở rộng của Dashboard", dùng chung đúng bộ chỉ số Mục 9, tài liệu
 * 09, chỉ khác ở chỗ lọc sâu hơn + xem breakdown chi tiết. Quyền xem GET
 * /report/funnel + /report/by-source: Leader/Quản lý/Admin (Mục 8, docs/13)
 * — Sale/MKT không có trang này (khớp mục roles của nav item, layout.tsx).
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user || !["admin", "manager", "leader"].includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;
  const getParam = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const canFilterByTeam = ["admin", "manager"].includes(user.role);

  const initialTeamId = getParam("team_id") ?? "";
  const initialAccountId = getParam("account_id") ?? "";
  const initialSourceId = getParam("source_id") ?? "";

  // Chỉ khi URL thực sự mang date_from/date_to (vd. link "Xem chi tiết
  // trong Báo cáo" từ popup Dashboard) mới coi là người dùng đã chọn
  // khoảng ngày tường minh (preset "Tùy chọn") — nếu không, trang vẫn dùng
  // đúng mặc định preset "Tháng này" như Dashboard.
  const hasExplicitDateFilter = Boolean(getParam("date_from") || getParam("date_to"));

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
  const initialDateFrom = getParam("date_from") ?? startOfMonth.toISOString();
  const initialDateTo = getParam("date_to") ?? endOfToday.toISOString();

  const baseQuery = new URLSearchParams({ date_from: initialDateFrom, date_to: initialDateTo });
  if (initialTeamId) baseQuery.set("team_id", initialTeamId);
  if (initialSourceId) baseQuery.set("source_id", initialSourceId);

  const funnelQuery = new URLSearchParams(baseQuery);
  if (initialAccountId) funnelQuery.set("account_id", initialAccountId);

  const [funnel, bySource, teamsResult, sources] = await Promise.all([
    serverApi<FunnelStep[]>(`/report/funnel?${funnelQuery.toString()}`),
    serverApi<BySourceReport[]>(`/report/by-source?${baseQuery.toString()}`),
    canFilterByTeam
      ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
    serverApi<LeadSource[]>("/lead-source"),
  ]);

  const teamsForMembers = canFilterByTeam ? teamsResult.items : user.team_id ? [{ id: user.team_id }] : [];
  const saleMembers = (
    await Promise.all(teamsForMembers.map((team) => serverApi<TeamMember[]>(`/team/${team.id}/member`)))
  ).flat();

  return (
    <ReportsClient
      canFilterByTeam={canFilterByTeam}
      teams={teamsResult.items}
      saleMembers={saleMembers}
      sources={sources}
      initialDatePresetIsCustom={hasExplicitDateFilter}
      initialFilters={{
        team_id: initialTeamId,
        account_id: initialAccountId,
        source_id: initialSourceId,
        date_from: initialDateFrom,
        date_to: initialDateTo,
      }}
      initialFunnel={funnel}
      initialBySource={bySource}
    />
  );
}

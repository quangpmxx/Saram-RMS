import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { Candidate, LeadSource, PaginatedResult, StatusCatalogItem, Team, TeamMember } from "@/lib/types";
import { EMPTY_DATE_RANGE, type DateRangeValue } from "@/lib/date-range";
import { CandidatesClient } from "./candidates-client";
import type { TeamSaleValue } from "./team-sale-filter";

/**
 * Phase 1 (S3 rút gọn, tài liệu 10/12): Admin, Quản lý, MKT.
 * Phase 2 (docs/14-roadmap.md): mở thêm cho Leader ("Chờ phân chia" + phân
 * chia/chuyển lead trong nhóm mình) và Sale ("Lead của tôi" — tự động giới
 * hạn đúng phạm vi qua GET /candidate, không cần trang riêng — Mục 8, docs/09).
 * UI Polish: danh sách nhóm (GET /team) chỉ tải cho Admin/Quản lý/Leader —
 * đúng phạm vi quyền đã chốt của API này (Mục 3, docs/13) — để hiện tên
 * nhóm dưới tên Sale trong cột "Nhân viên"; Sale/MKT không gọi được API
 * này nên cột Nhân viên với 2 vai trò đó chỉ hiện tên Sale, không có nhóm.
 * UI Polish: bộ lọc "Nhóm / Nhân viên" — Admin/Quản lý tải toàn bộ Sale
 * bằng cách gọi GET /team/:id/member cho từng nhóm (API đã có sẵn, không
 * thêm route mới); Leader tái dùng đúng danh sách Sale nhóm mình đã có sẵn
 * (initialTeamMembers). Sale/MKT không gọi được GET /team nên KHÔNG hiện bộ
 * lọc này (giữ nguyên phân quyền hiện có, không mở rộng quyền truy cập API).
 * Phase 7: đọc query param trên URL (view/source_id/date_from/date_to/
 * team_id/assigned_to/keyword) để
 * mở sẵn đúng danh sách đã lọc khi bấm vào 1 con số breakdown từ Dashboard/
 * Reports (Mục 1/8, docs/12; tiêu chí hoàn thành Phase 7, docs/14-roadmap.md)
 * — không có param nào thì hành vi giữ nguyên y hệt trước (mặc định rỗng).
 */
export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();

  if (!user || !["admin", "manager", "mkt", "leader", "sale"].includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;
  const getParam = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // Dự án phụ — nâng cấp toàn diện: bổ sung 'mkt' — MKT giờ bắt buộc chọn
  // nhóm khi up data mới, cần danh sách nhóm để hiển thị lựa chọn.
  const canListTeams = ["admin", "manager", "leader", "mkt"].includes(user.role);
  const canBrowseAllSales = ["admin", "manager"].includes(user.role);
  // Dự án phụ — nâng cấp toàn diện: Sale giờ cũng xem "Chờ phân chia" (tự
  // nhận data). "Cột chăm sóc" đã ẩn khỏi UI — không còn nhận view=care_pool.
  const canViewPending = ["admin", "manager", "leader", "mkt", "sale"].includes(user.role);
  const canViewMine = user.role === "sale";

  const requestedView = getParam("view");
  const initialViewMode =
    requestedView === "pending" && canViewPending
      ? ("pending" as const)
      : requestedView === "mine" && canViewMine
        ? ("mine" as const)
        : ("all" as const);

  const sourceId = getParam("source_id");
  const dateFrom = getParam("date_from");
  const dateTo = getParam("date_to");
  const teamIdParam = getParam("team_id");
  const assignedTo = getParam("assigned_to");
  const keyword = getParam("keyword");

  const initialFilters: {
    keyword: string;
    source_id: string;
    team_sale: TeamSaleValue | null;
    date: DateRangeValue;
  } = {
    keyword: keyword ?? "",
    source_id: sourceId ?? "",
    team_sale: teamIdParam ? { type: "team", id: teamIdParam } : assignedTo ? { type: "sale", id: assignedTo } : null,
    date: dateFrom || dateTo ? { preset: "custom", from: dateFrom ?? "", to: dateTo ?? "" } : EMPTY_DATE_RANGE,
  };

  const candidateQuery = new URLSearchParams({ page: "1", page_size: "50" });
  if (initialViewMode === "all" || initialViewMode === "mine") {
    if (keyword) candidateQuery.set("keyword", keyword);
    if (sourceId) candidateQuery.set("source_id", sourceId);
    if (teamIdParam) candidateQuery.set("team_id", teamIdParam);
    if (assignedTo) candidateQuery.set("assigned_to", assignedTo);
    if (dateFrom) candidateQuery.set("date_from", new Date(dateFrom).toISOString());
    if (dateTo) candidateQuery.set("date_to", new Date(`${dateTo}T23:59:59.999`).toISOString());
    if (initialViewMode === "mine") candidateQuery.set("assigned_to", "me");
  } else if (initialViewMode === "pending") {
    // Đúng theo refresh() trong candidates-client.tsx: "Chờ phân chia" chỉ
    // nhận page/page_size/source_id, không nhận khoảng ngày.
    if (sourceId) candidateQuery.set("source_id", sourceId);
  }

  const candidateEndpoint =
    initialViewMode === "pending"
      ? `/candidate/pending?${candidateQuery.toString()}`
      : `/candidate?${candidateQuery.toString()}`;

  const [candidatesResult, sources, teamMembers, teamsResult, zaloStatuses] = await Promise.all([
    serverApi<PaginatedResult<Candidate>>(candidateEndpoint),
    serverApi<LeadSource[]>("/lead-source"),
    user.role === "leader" && user.team_id
      ? serverApi<TeamMember[]>(`/team/${user.team_id}/member`)
      : Promise.resolve<TeamMember[]>([]),
    canListTeams
      ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
    serverApi<StatusCatalogItem[]>("/status?category=zalo_status"),
  ]);

  const allSaleMembers = canBrowseAllSales
    ? (
        await Promise.all(
          teamsResult.items.map((team) => serverApi<TeamMember[]>(`/team/${team.id}/member`)),
        )
      ).flat()
    : teamMembers;

  return (
    <CandidatesClient
      initialCandidates={candidatesResult.items}
      initialTotal={candidatesResult.total}
      sources={sources}
      currentUserId={user.id}
      currentUserRole={user.role}
      currentUserTeamId={user.team_id}
      initialTeamMembers={teamMembers}
      teams={teamsResult.items}
      allSaleMembers={allSaleMembers}
      zaloStatuses={zaloStatuses}
      initialViewMode={initialViewMode}
      initialFilters={initialFilters}
    />
  );
}

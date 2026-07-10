import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { Candidate, LeadSource, PaginatedResult, StatusCatalogItem, Team, TeamMember } from "@/lib/types";
import { CandidatesClient } from "./candidates-client";

/**
 * Phase 1 (S3 rút gọn, tài liệu 10/12): Admin, Quản lý, MKT.
 * Phase 2 (docs/14-roadmap.md): mở thêm cho Leader ("Chờ phân chia" + phân
 * chia/chuyển lead trong nhóm mình) và Sale ("Lead của tôi" — tự động giới
 * hạn đúng phạm vi qua GET /candidate, không cần trang riêng — Mục 8, docs/09).
 * Phase 4: cột + filter Trạng thái PV/Trạng thái đi làm (Mục 2.1, docs/12).
 * UI Polish: danh sách nhóm (GET /team) chỉ tải cho Admin/Quản lý/Leader —
 * đúng phạm vi quyền đã chốt của API này (Mục 3, docs/13) — để hiện tên
 * nhóm dưới tên Sale trong cột "Nhân viên"; Sale/MKT không gọi được API
 * này nên cột Nhân viên với 2 vai trò đó chỉ hiện tên Sale, không có nhóm.
 * UI Polish: bộ lọc "Nhóm / Nhân viên" — Admin/Quản lý tải toàn bộ Sale
 * bằng cách gọi GET /team/:id/member cho từng nhóm (API đã có sẵn, không
 * thêm route mới); Leader tái dùng đúng danh sách Sale nhóm mình đã có sẵn
 * (initialTeamMembers). Sale/MKT không gọi được GET /team nên KHÔNG hiện bộ
 * lọc này (giữ nguyên phân quyền hiện có, không mở rộng quyền truy cập API).
 */
export default async function CandidatesPage() {
  const user = await getCurrentUser();

  if (!user || !["admin", "manager", "mkt", "leader", "sale"].includes(user.role)) {
    redirect("/");
  }

  const canListTeams = ["admin", "manager", "leader"].includes(user.role);
  const canBrowseAllSales = ["admin", "manager"].includes(user.role);

  const [candidatesResult, sources, teamMembers, interviewStatuses, employmentStatuses, teamsResult] =
    await Promise.all([
      serverApi<PaginatedResult<Candidate>>("/candidate?page=1&page_size=50"),
      serverApi<LeadSource[]>("/lead-source"),
      user.role === "leader" && user.team_id
        ? serverApi<TeamMember[]>(`/team/${user.team_id}/member`)
        : Promise.resolve<TeamMember[]>([]),
      serverApi<StatusCatalogItem[]>("/status?category=interview_status"),
      serverApi<StatusCatalogItem[]>("/status?category=employment_status"),
      canListTeams
        ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
        : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
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
      interviewStatuses={interviewStatuses}
      employmentStatuses={employmentStatuses}
      teams={teamsResult.items}
      allSaleMembers={allSaleMembers}
    />
  );
}

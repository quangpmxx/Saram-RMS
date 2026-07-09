import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { Candidate, LeadSource, PaginatedResult, TeamMember } from "@/lib/types";
import { CandidatesClient } from "./candidates-client";

/**
 * Phase 1 (S3 rút gọn, tài liệu 10/12): Admin, Quản lý, MKT.
 * Phase 2 (docs/14-roadmap.md): mở thêm cho Leader ("Chờ phân chia" + phân
 * chia/chuyển lead trong nhóm mình) và Sale ("Lead của tôi" — tự động giới
 * hạn đúng phạm vi qua GET /candidate, không cần trang riêng — Mục 8, docs/09).
 */
export default async function CandidatesPage() {
  const user = await getCurrentUser();

  if (!user || !["admin", "manager", "mkt", "leader", "sale"].includes(user.role)) {
    redirect("/");
  }

  const [candidatesResult, sources, teamMembers] = await Promise.all([
    serverApi<PaginatedResult<Candidate>>("/candidate?page=1&page_size=50"),
    serverApi<LeadSource[]>("/lead-source"),
    user.role === "leader" && user.team_id
      ? serverApi<TeamMember[]>(`/team/${user.team_id}/member`)
      : Promise.resolve<TeamMember[]>([]),
  ]);

  return (
    <CandidatesClient
      initialCandidates={candidatesResult.items}
      initialTotal={candidatesResult.total}
      sources={sources}
      currentUserId={user.id}
      currentUserRole={user.role}
      currentUserTeamId={user.team_id}
      initialTeamMembers={teamMembers}
    />
  );
}

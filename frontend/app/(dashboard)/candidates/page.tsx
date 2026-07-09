import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { Candidate, LeadSource, PaginatedResult } from "@/lib/types";
import { CandidatesClient } from "./candidates-client";

/**
 * Phase 1, docs/14-roadmap.md — S3 rút gọn (tài liệu 10/12). Chỉ Admin,
 * Quản lý, MKT có màn hình này ở Phase 1 (Sale/Leader chưa có dữ liệu gì để
 * xem cho tới khi Phase 2 xây dựng phân chia — xem Mục 8, docs/09).
 */
export default async function CandidatesPage() {
  const user = await getCurrentUser();

  if (!user || !["admin", "manager", "mkt"].includes(user.role)) {
    redirect("/");
  }

  const [candidatesResult, sources] = await Promise.all([
    serverApi<PaginatedResult<Candidate>>("/candidate?page=1&page_size=50"),
    serverApi<LeadSource[]>("/lead-source"),
  ]);

  return (
    <CandidatesClient
      initialCandidates={candidatesResult.items}
      initialTotal={candidatesResult.total}
      sources={sources}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}

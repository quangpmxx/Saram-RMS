import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi, ApiError } from "@/lib/api-server";
import type { Candidate, Note, StatusCatalogItem } from "@/lib/types";
import { CandidateDetailClient } from "./candidate-detail-client";

/**
 * S5 (phần cuộc gọi/ghi chú), Mục 2.2, docs/12-ui-design.md — Phase 3.
 * Dự án phụ — nâng cấp toàn diện: bỏ hẳn phần "Phỏng vấn & đi làm" khỏi
 * trang này (sẽ làm lại thành 1 trang riêng, nhập thủ công — tính sau) —
 * không còn tải GET /candidate/:id/interview hay danh mục trạng thái PV/đi làm.
 */
export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user || !["admin", "manager", "mkt", "leader", "sale"].includes(user.role)) {
    redirect("/");
  }

  let candidate: Candidate;
  let notes: Note[];
  try {
    [candidate, notes] = await Promise.all([
      serverApi<Candidate>(`/candidate/${id}`),
      serverApi<Note[]>(`/candidate/${id}/note`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  const [callStatuses, callResults, zaloStatuses] = await Promise.all([
    serverApi<StatusCatalogItem[]>("/status?category=call_status"),
    serverApi<StatusCatalogItem[]>("/status?category=call_result"),
    serverApi<StatusCatalogItem[]>("/status?category=zalo_status"),
  ]);

  return (
    <CandidateDetailClient
      initialCandidate={candidate}
      initialNotes={notes}
      callStatuses={callStatuses}
      callResults={callResults}
      zaloStatuses={zaloStatuses}
      currentUserId={user.id}
      currentUserRole={user.role}
      currentUserTeamId={user.team_id}
    />
  );
}

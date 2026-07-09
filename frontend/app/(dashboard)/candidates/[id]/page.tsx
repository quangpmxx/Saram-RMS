import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi, ApiError } from "@/lib/api-server";
import type { Candidate, Note, StatusCatalogItem } from "@/lib/types";
import { CandidateDetailClient } from "./candidate-detail-client";

/**
 * S5 (phần cuộc gọi/ghi chú), Mục 2.2, docs/12-ui-design.md — Phase 3.
 * Lịch hẹn PV/gọi lại/kết quả đi làm thuộc Phase 4, chưa hiện thực ở đây.
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

  const [callStatuses, callResults] = await Promise.all([
    serverApi<StatusCatalogItem[]>("/status?category=call_status"),
    serverApi<StatusCatalogItem[]>("/status?category=call_result"),
  ]);

  return (
    <CandidateDetailClient
      initialCandidate={candidate}
      initialNotes={notes}
      callStatuses={callStatuses}
      callResults={callResults}
      currentUserId={user.id}
      currentUserRole={user.role}
      currentUserTeamId={user.team_id}
    />
  );
}

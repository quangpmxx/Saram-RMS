import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi, ApiError } from "@/lib/api-server";
import type { Candidate, Interview, Note, StatusCatalogItem } from "@/lib/types";
import { CandidateDetailClient } from "./candidate-detail-client";

/**
 * S5 (phần cuộc gọi/ghi chú), Mục 2.2, docs/12-ui-design.md — Phase 3 +
 * Phase 4 (lịch sử hẹn PV, cập nhật kết quả PV/đi làm, đặt lịch gọi lại).
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
  let interviews: Interview[];
  try {
    [candidate, notes, interviews] = await Promise.all([
      serverApi<Candidate>(`/candidate/${id}`),
      serverApi<Note[]>(`/candidate/${id}/note`),
      serverApi<Interview[]>(`/candidate/${id}/interview`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  const [callStatuses, callResults, interviewStatuses, employmentStatuses] = await Promise.all([
    serverApi<StatusCatalogItem[]>("/status?category=call_status"),
    serverApi<StatusCatalogItem[]>("/status?category=call_result"),
    serverApi<StatusCatalogItem[]>("/status?category=interview_status"),
    serverApi<StatusCatalogItem[]>("/status?category=employment_status"),
  ]);

  return (
    <CandidateDetailClient
      initialCandidate={candidate}
      initialNotes={notes}
      initialInterviews={interviews}
      callStatuses={callStatuses}
      callResults={callResults}
      interviewStatuses={interviewStatuses}
      employmentStatuses={employmentStatuses}
      currentUserId={user.id}
      currentUserRole={user.role}
      currentUserTeamId={user.team_id}
    />
  );
}

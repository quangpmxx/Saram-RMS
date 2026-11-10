import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi, ApiError } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import type { Candidate, Note, StatusCatalogItem } from "@/lib/types";
import { CandidateDetailClient } from "./candidate-detail-client";

/**
 * Nội dung trang Chi tiết lao động — dùng chung cho trang riêng (mở thẳng
 * link / tải lại) và popup (2026-11-10: bấm từ trong app thì mở popup, xem
 * app/(dashboard)/@modal/(.)candidates/[id]/page.tsx).
 */
export async function CandidateDetailContent({ id, inModal = false }: { id: string; inModal?: boolean }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const permissionLevel = await requirePageAccess("candidates");

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

  const [callStatuses, callResults, zaloStatuses, zaloFriendStatuses] = await Promise.all([
    serverApi<StatusCatalogItem[]>("/status?category=call_status"),
    serverApi<StatusCatalogItem[]>("/status?category=call_result"),
    serverApi<StatusCatalogItem[]>("/status?category=zalo_status"),
    serverApi<StatusCatalogItem[]>("/status?category=zalo_friend_status"),
  ]);

  return (
    <CandidateDetailClient
      permissionLevel={permissionLevel}
      initialCandidate={candidate}
      initialNotes={notes}
      callStatuses={callStatuses}
      callResults={callResults}
      zaloStatuses={zaloStatuses}
      zaloFriendStatuses={zaloFriendStatuses}
      currentUserId={user.id}
      currentUserRole={user.role}
      currentUserTeamId={user.team_id}
      inModal={inModal}
    />
  );
}

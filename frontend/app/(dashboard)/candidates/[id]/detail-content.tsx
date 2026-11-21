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
  // Mở data chậm vài giây (2026-11-20): trước đây 4 lượt gọi máy chủ nối đuôi nhau + 1 lượt khoá
  // "đang ở trong data" phía trình duyệt mới hiện nội dung. Giờ gọi TẤT CẢ cùng lúc (1 lượt chờ).
  // Lỗi API của data/khoá được giữ lại làm giá trị để vẫn kiểm đăng nhập + quyền trang TRƯỚC (như cũ).
  const asResult = <T,>(p: Promise<T>) =>
    p.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => {
        if (error instanceof ApiError) return { ok: false as const, error };
        throw error; // redirect() (hết phiên) và lỗi khác giữ nguyên hành vi cũ
      },
    );
  const [user, permissionLevel, main, statuses, lock, campaign] = await Promise.all([
    getCurrentUser(),
    requirePageAccess("candidates"),
    asResult(Promise.all([serverApi<Candidate>(`/candidate/${id}`), serverApi<Note[]>(`/candidate/${id}/note`)])),
    Promise.all([
      serverApi<StatusCatalogItem[]>("/status?category=call_status"),
      serverApi<StatusCatalogItem[]>("/status?category=call_result"),
      serverApi<StatusCatalogItem[]>("/status?category=zalo_status"),
      serverApi<StatusCatalogItem[]>("/status?category=zalo_friend_status"),
    ]),
    asResult(serverApi(`/candidate/${id}/open-lock`, { method: "POST" })),
    // Nhóm quảng cáo (ad set) (2026-11-21) — lỗi thì bỏ qua, không chặn trang.
    asResult(
      serverApi<{ ad_campaign: { ad_id: string; adset_name: string | null } | null }>(`/candidate/${id}/ad-campaign`),
    ),
  ]);
  if (!user) {
    redirect("/login");
  }
  if (!main.ok) {
    if (main.error.status === 404 || main.error.status === 403) notFound();
    throw main.error;
  }
  const [candidate, notes] = main.value;
  const [callStatuses, callResults, zaloStatuses, zaloFriendStatuses] = statuses;
  // Khoá "đang ở trong data": 409 = người khác đang ở trong; lỗi khác không chặn trang (như phía trình duyệt).
  const initialOpenLock =
    !lock.ok && lock.error.status === 409
      ? { status: "blocked" as const, message: lock.error.message }
      : { status: "ok" as const };

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
      initialOpenLock={initialOpenLock}
      adCampaign={campaign.ok ? campaign.value.ad_campaign : null}
    />
  );
}

import { hasCap } from "@/lib/capabilities";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import type { DashboardSummary, LeadSource, PaginatedResult, SalePerformance, Team, TeamSummary } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

/**
 * Phase 7 (docs/14-roadmap.md) — thay thế trang "Trang chủ" tạm thời (link
 * nhanh + vài con số) bằng Dashboard thật theo Mục 1, docs/12 + Mục 9,
 * docs/09. Quyền xem GET /dashboard/summary: tất cả vai trò (Mục 8,
 * docs/13); performance = Leader/Quản lý/Admin; by-team = Quản lý/Admin.
 * Mặc định khoảng thời gian "Hôm nay" (yêu cầu người dùng 2026-11-10; trước là
 * "Tháng này"). Phải khớp mặc định trong DashboardClient.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  // Dashboard không có thao tác thêm/sửa/xóa nào — chỉ cần chặn truy cập
  // khi "none", không cần phân biệt view/edit ở giao diện.
  await requirePageAccess("dashboard");

  // Rà soát phân quyền 2026-10-30: mọi vai trò xem số liệu chung, Top 3 và
  // hiệu suất theo nhóm toàn công ty; bảng "Hiệu suất từng nhân viên" backend
  // tự thu hẹp (Sale: mình, Leader: nhóm mình). Lọc nhóm: Admin/Quản lý/MKT;
  // lọc nhân viên: thêm Leader (nhân viên nhóm mình).
  const canViewPerformance = true;
  const canViewByTeam = true;
  const canFilterByTeam = hasCap(user, "dashboard.filter_all");
  const canFilterBySale = hasCap(user, "dashboard.filter_all");

  // "Hôm nay" theo giờ Việt Nam, tính GIỐNG HỆT lúc bấm lọc ở DashboardClient
  // (date_from = ngày dạng YYYY-MM-DD, date_to = 23:59:59.999 giờ VN) để số
  // liệu lúc mở trang khớp với khi chọn lại "Hôm nay".
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const dateQuery = new URLSearchParams({
    date_from: new Date(today).toISOString(),
    date_to: new Date(`${today}T23:59:59.999+07:00`).toISOString(),
  });

  const [summary, performance, ranking, byTeam, teamsResult, sources] = await Promise.all([
    serverApi<DashboardSummary>(`/dashboard/summary?${dateQuery.toString()}`),
    canViewPerformance
      ? serverApi<SalePerformance[]>(`/dashboard/performance?${dateQuery.toString()}`)
      : Promise.resolve<SalePerformance[]>([]),
    serverApi<SalePerformance[]>(`/dashboard/ranking?${dateQuery.toString()}`),
    canViewByTeam
      ? serverApi<TeamSummary[]>(`/dashboard/by-team?${dateQuery.toString()}`)
      : Promise.resolve<TeamSummary[]>([]),
    canFilterByTeam
      ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
    serverApi<LeadSource[]>("/lead-source"),
  ]);

  return (
    <DashboardClient
      currentUserFullName={user.full_name}
      currentUserId={user.id}
      currentUserTeamId={user.team_id}
      currentUserRole={user.role}
      canViewPerformance={canViewPerformance}
      canViewByTeam={canViewByTeam}
      canFilterByTeam={canFilterByTeam}
      canFilterBySale={canFilterBySale}
      teams={teamsResult.items}
      sources={sources}
      initialSummary={summary}
      initialPerformance={performance}
      initialRanking={ranking}
      initialByTeam={byTeam}
    />
  );
}

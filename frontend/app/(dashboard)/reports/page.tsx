import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { DailyReportRow, DailyReportSummary, PaginatedResult, Team, TeamMember } from "@/lib/types";
import { ReportsClient } from "./reports-client";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — thiết kế lại toàn bộ nội dung trang "Báo cáo" thành Báo cáo
 * hằng ngày theo nhóm/nhân viên, yêu cầu trực tiếp người dùng). Mặc định
 * xem đúng HÔM NAY (theo giờ Việt Nam, do server tính — khớp cách backend
 * xác định "hôm nay" ở daily-reports.service.ts) — "báo cáo hằng ngày" nên
 * mặc định hẹp, không mở sẵn cả tháng như Dashboard cũ.
 *
 * Quyền xem (Mục 3, yêu cầu người dùng): Admin/Quản lý (toàn bộ) + Leader
 * (nhóm mình) + Nhân viên/Sale (chỉ chính mình, có nút "Nhập báo cáo hằng
 * ngày") — KHÁC trang Báo cáo cũ (không có Sale) nên đã bổ sung "sale" vào
 * roles của mục nav "/reports" ở layout.tsx (chỉ đúng 1 dòng, không đụng
 * mục nav nào khác).
 */
export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user || !["admin", "manager", "leader", "sale"].includes(user.role)) {
    redirect("/");
  }

  const canFilterByTeam = ["admin", "manager"].includes(user.role);
  const canFilterBySale = ["admin", "manager", "leader"].includes(user.role);
  const canSubmitReport = user.role === "sale";

  // Không tự tính "hôm nay" ở đây (new Date().toISOString() lấy theo giờ
  // UTC — lệch mất 1 ngày vào khoảng 00:00-07:00 giờ Việt Nam, đúng lỗi đã
  // cảnh báo ở lib/date-range.ts). Để trống date_from/date_to, backend tự
  // mặc định đúng "hôm nay" theo giờ Việt Nam (daily-reports.service.ts,
  // toDateOnly()) — sau đó suy ngược lại chuỗi ngày từ chính dữ liệu trả về.
  const [initialSummary, initialRows, teamsResult] = await Promise.all([
    serverApi<DailyReportSummary>("/daily-report/summary"),
    serverApi<DailyReportRow[]>("/daily-report"),
    canFilterByTeam
      ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
  ]);

  const teamsForMembers = canFilterByTeam ? teamsResult.items : user.team_id ? [{ id: user.team_id }] : [];
  const saleMembers = canFilterBySale
    ? (await Promise.all(teamsForMembers.map((team) => serverApi<TeamMember[]>(`/team/${team.id}/member`)))).flat()
    : [];

  const today = initialRows[0]?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <ReportsClient
      currentUserRole={user.role}
      canFilterByTeam={canFilterByTeam}
      canFilterBySale={canFilterBySale}
      canSubmitReport={canSubmitReport}
      teams={teamsResult.items}
      saleMembers={saleMembers}
      initialDateFrom={today}
      initialDateTo={today}
      initialSummary={initialSummary}
      initialRows={initialRows}
    />
  );
}

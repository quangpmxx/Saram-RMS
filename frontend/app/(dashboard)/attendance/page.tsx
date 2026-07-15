import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { AttendanceGrid, PaginatedResult, Team, TeamMember } from "@/lib/types";
import { AttendanceClient } from "./attendance-client";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module hoàn toàn mới, yêu cầu trực tiếp người dùng): "Chấm
 * công thủ công". Quyền xem (Mục 8): Admin/Quản lý toàn bộ, Leader nhóm
 * mình, Nhân viên (MKT/Sale) chỉ chính mình — RBAC chi tiết nằm ở
 * attendance.service.ts, trang này chỉ chặn thô ở tầng route.
 */
export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canFilterByTeam = ["admin", "manager"].includes(user.role);
  const canFilterByAccount = ["admin", "manager", "leader"].includes(user.role);

  // Không dùng new Date().getFullYear()/getMonth() (giờ UTC của server có
  // thể lệch ngày với giờ Việt Nam) — tính tháng/năm mặc định theo đúng múi
  // giờ Việt Nam, khớp quy ước đã dùng ở daily-reports.service.ts.
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-");
  const year = Number(nowParts[0]);
  const month = Number(nowParts[1]);

  const [initialGrid, teamsResult] = await Promise.all([
    serverApi<AttendanceGrid>(`/attendance?year=${year}&month=${month}`),
    canFilterByTeam
      ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
  ]);

  const teamsForMembers = canFilterByTeam ? teamsResult.items : user.team_id ? [{ id: user.team_id }] : [];
  const accountOptions = canFilterByAccount
    ? (await Promise.all(teamsForMembers.map((team) => serverApi<TeamMember[]>(`/team/${team.id}/member`)))).flat()
    : [];

  return (
    <AttendanceClient
      currentUserId={user.id}
      currentUserRole={user.role}
      canFilterByTeam={canFilterByTeam}
      canFilterByAccount={canFilterByAccount}
      teams={teamsResult.items}
      accountOptions={accountOptions}
      initialYear={year}
      initialMonth={month}
      initialGrid={initialGrid}
    />
  );
}

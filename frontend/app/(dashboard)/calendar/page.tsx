import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { CalendarEvent, PaginatedResult, Team, TeamMember } from "@/lib/types";
import { CalendarClient } from "./calendar-client";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Mục 7, docs/12-ui-design.md (S10) — góc nhìn lịch cho lịch gọi lại + lịch
 * hẹn PV. Mục 10, docs/10 loại MKT khỏi menu "Lịch hẹn" (MKT chỉ xem dữ
 * liệu ứng viên, không xử lý pipeline) — dù GET /calendar (Mục 7, docs/13)
 * cho phép "Tất cả vai trò" gọi API, trang này chỉ hiện đúng theo menu đã
 * chốt, giống cách các trang khác trong hệ thống giới hạn theo đúng nav.
 */
export default async function CalendarPage() {
  const user = await getCurrentUser();

  if (!user || !["admin", "manager", "leader", "sale"].includes(user.role)) {
    redirect("/");
  }

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 7);
  const to = new Date(today);
  to.setDate(to.getDate() + 30);

  const dateFrom = toDateInputValue(from);
  const dateTo = toDateInputValue(to);

  const events = await serverApi<CalendarEvent[]>(
    `/calendar?date_from=${dateFrom}&date_to=${dateTo}`,
  );

  // Dự án phụ — nâng cấp toàn diện (yêu cầu trực tiếp người dùng,
  // 2026-07-14): bộ lọc "Nhân viên" — chỉ có ý nghĩa với Admin/Quản
  // lý/Leader (Sale chỉ thấy đúng lịch của mình nên không cần chọn ai khác).
  // Tái dùng đúng cách candidates/page.tsx đã lấy danh sách Sale (gọi
  // GET /team/:id/member cho từng nhóm — Admin/Quản lý; Leader dùng lại
  // danh sách nhóm mình đã có sẵn) — không thêm endpoint mới.
  const canFilterBySale = ["admin", "manager", "leader"].includes(user.role);
  const canBrowseAllSales = ["admin", "manager"].includes(user.role);

  const [teamMembers, teamsResult] = await Promise.all([
    user.role === "leader" && user.team_id
      ? serverApi<TeamMember[]>(`/team/${user.team_id}/member`)
      : Promise.resolve<TeamMember[]>([]),
    canBrowseAllSales
      ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
  ]);

  const saleMembers = canBrowseAllSales
    ? (
        await Promise.all(
          teamsResult.items.map((team) => serverApi<TeamMember[]>(`/team/${team.id}/member`)),
        )
      ).flat()
    : teamMembers;

  return (
    <CalendarClient
      initialEvents={events}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      canFilterBySale={canFilterBySale}
      saleMembers={saleMembers}
    />
  );
}

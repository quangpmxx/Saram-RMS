import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { CalendarEvent } from "@/lib/types";
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

  return <CalendarClient initialEvents={events} initialDateFrom={dateFrom} initialDateTo={dateTo} />;
}

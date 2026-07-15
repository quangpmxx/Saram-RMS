import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CheckinClient } from "./checkin-client";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13 — trang mới, yêu cầu trực tiếp người dùng): "Check in GPS" —
 * PHASE 1/4. Mục 1: chỉ Nhân viên/Sale, MKT, Leader tự Check in — Admin/
 * Quản lý không dùng, chặn thẳng ở tầng route (khớp CHECKIN_ROLES backend,
 * checkin.service.ts) để tránh vào nhầm trang không dùng được.
 */
export default async function AttendanceCheckinPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin" || user.role === "manager") redirect("/");

  return <CheckinClient user={user} />;
}

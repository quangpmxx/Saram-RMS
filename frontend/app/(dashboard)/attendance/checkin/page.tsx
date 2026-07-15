import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CheckinClient } from "./checkin-client";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13 — trang mới): "Check in" — mở từ nút cạnh "Tháng hiện tại"
 * trong module Chấm công, mở ở tab trình duyệt mới (yêu cầu trực tiếp
 * người dùng). CHỈ khung sườn — nội dung thật người dùng sẽ phổ biến sau,
 * không tự phát minh nghiệp vụ/DB/API cho trang này.
 */
export default async function AttendanceCheckinPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <CheckinClient />;
}

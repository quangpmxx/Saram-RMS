import { redirect } from "next/navigation";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, yêu cầu trực tiếp người
 * dùng): "Gộp quản lý nhóm vào trong quản lý tài khoản" — Quản lý nhóm
 * không còn là trang riêng, chuyển vào làm tab trong /accounts (xem
 * accounts-client.tsx). Giữ redirect ở đây để link/bookmark cũ tới /teams
 * vẫn dẫn đúng chỗ thay vì lỗi 404.
 */
export default function TeamsPage() {
  redirect("/accounts");
}

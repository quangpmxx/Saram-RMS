import { redirect } from "next/navigation";

/** Đường dẫn cũ — "Phân quyền" đã chuyển vào trong Quản lý tài khoản. */
export default function OldPermissionsPage() {
  redirect("/accounts/permissions");
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { requirePageAccess } from "@/lib/module-permission";
import { AccountingClient } from "./accounting-client";

/** Kế toán = Tiền lương (2026-11-13): Kế toán/Admin sửa, Quản lý chỉ xem (module-registry.ts). */
export default async function AccountingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const permissionLevel = await requirePageAccess("accounting");

  // Tháng hiện tại theo giờ Việt Nam — khớp cách tính ở trang Chấm công.
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);

  return <AccountingClient permissionLevel={permissionLevel} initialYear={year} initialMonth={month} />;
}

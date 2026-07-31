import type { NavIconKey } from "@/components/sidebar-nav";
import type { AccountRole } from "./types";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): "Phân quyền" phiên bản đơn giản — nguồn DUY NHẤT liệt kê module
 * trên sidebar, dùng chung cho: menu (layout.tsx), gate từng trang
 * (module-permission.ts#requirePageAccess), và trang Admin "Phân quyền".
 * Danh sách + `defaultRoles` phải khớp ĐÚNG với
 * backend/src/module-permission/module-registry.ts (2 file không import
 * chung được vì Next.js/NestJS là 2 dự án riêng) — sửa 1 bên nhớ sửa bên
 * kia.
 */
export interface ModuleRegistryEntry {
  code: string;
  href: string;
  label: string;
  icon: NavIconKey;
  defaultRoles: AccountRole[];
}

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  { code: "dashboard", href: "/", label: "Trang chủ Dashboard", icon: "home", defaultRoles: ["admin", "manager", "leader", "mkt", "sale"] },
  {
    code: "candidates",
    href: "/candidates",
    label: "Data lao động",
    icon: "candidates",
    defaultRoles: ["admin", "manager", "mkt", "leader", "sale"],
  },
  {
    code: "shuttle",
    href: "/shuttle",
    label: "Danh sách đưa đón",
    icon: "shuttle",
    defaultRoles: ["admin", "manager", "leader", "mkt", "sale"],
  },
  { code: "reports", href: "/reports", label: "Báo cáo", icon: "reports", defaultRoles: ["admin", "manager", "leader", "sale"] },
  {
    code: "attendance",
    href: "/attendance",
    label: "Chấm công",
    icon: "attendance",
    defaultRoles: ["admin", "manager", "leader", "mkt", "sale"],
  },
  { code: "accounting", href: "/accounting", label: "Kế toán", icon: "accounting", defaultRoles: ["admin"] },
  {
    code: "sales-entry",
    href: "/sales-entry",
    label: "Nhập doanh số",
    icon: "salesEntry",
    // Yêu cầu trực tiếp người dùng (2026-07-27): Sale tự nhập doanh số cho
    // chính mình; Leader/Quản lý/Admin/Kế toán giữ nguyên như trước. Phạm
    // vi xem/sửa chi tiết theo vai trò (Sale: chỉ dòng mình; Leader: cả
    // nhóm; còn lại: toàn bộ) enforce ở backend, không chỉ dừng ở đây.
    defaultRoles: ["admin", "manager", "leader", "sale", "accounting"],
  },
  {
    code: "order-management",
    href: "/order-management",
    label: "Quản lý đơn hàng",
    icon: "orderManagement",
    defaultRoles: ["admin"],
  },
  { code: "calendar", href: "/calendar", label: "Lịch hẹn", icon: "calendar", defaultRoles: ["admin", "manager", "leader", "sale"] },
  { code: "audit-log", href: "/audit-log", label: "Nhật ký", icon: "auditLog", defaultRoles: ["admin", "manager"] },
  { code: "accounts", href: "/accounts", label: "Quản lý tài khoản", icon: "accounts", defaultRoles: ["admin"] },
];

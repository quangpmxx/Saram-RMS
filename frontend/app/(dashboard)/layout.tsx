import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { type AccountRole } from "@/lib/types";
import { Logo } from "@/components/logo";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { SendNotificationButton } from "@/components/send-notification-button";
import { PageTitleProvider, PageTitleSlot } from "@/lib/page-title-context";
import { ToastProvider, ToastSlot } from "@/lib/toast-context";

const ALL_NAV_ITEMS: Array<NavItem & { roles: AccountRole[] }> = [
  { href: "/", label: "Trang chủ", icon: "home", roles: ["admin", "manager", "leader", "mkt", "sale"] },
  { href: "/candidates", label: "Data lao động", icon: "candidates", roles: ["admin", "manager", "mkt", "leader", "sale"] },
  { href: "/calendar", label: "Lịch hẹn", icon: "calendar", roles: ["admin", "manager", "leader", "sale"] },
  { href: "/reports", label: "Báo cáo", icon: "reports", roles: ["admin", "manager", "leader"] },
  {
    href: "/duplicates",
    label: "Trùng lặp",
    icon: "duplicates",
    roles: ["admin", "manager", "leader", "mkt", "sale"],
  },
  { href: "/audit-log", label: "Nhật ký", icon: "auditLog", roles: ["admin", "manager"] },
  { href: "/accounts", label: "Quản lý tài khoản", icon: "accounts", roles: ["admin"] },
  { href: "/teams", label: "Quản lý nhóm", icon: "teams", roles: ["admin"] },
  { href: "/settings", label: "Cấu hình vận hành", icon: "settings", roles: ["admin"] },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const navItems = ALL_NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <PageTitleProvider>
      <ToastProvider>
        <ToastSlot />
        {/*
          Sidebar cố định (yêu cầu tinh chỉnh trang đăng nhập/giao diện):
          từ breakpoint md trở lên, khóa toàn bộ khung ứng dụng đúng bằng chiều
          cao viewport ("md:h-screen md:overflow-hidden") rồi để CHỈ cột nội
          dung bên phải tự cuộn riêng ("md:overflow-y-auto") — <aside> là phần
          tử flex anh em cùng cấp, nằm ngoài vùng cuộn đó nên không bao giờ
          trôi theo khi cuộn trang. Chỉ áp dụng từ md trở lên (khớp đúng
          breakpoint CollapsibleSidebar đã ẩn trên mobile) để tránh lỗi 100vh
          khi thanh địa chỉ trình duyệt di động co giãn.
        */}
        <div className="flex min-h-screen bg-slate-50 md:h-screen md:overflow-hidden">
          <CollapsibleSidebar navItems={navItems} />

          <div className="flex min-w-0 flex-1 flex-col md:h-screen md:overflow-y-auto">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
              {/* UI Polish — tinh chỉnh mật độ hiển thị: py-2.5 → py-1.5 (giảm ~28% chiều
                  cao header khi cộng với avatar/font thu nhỏ trong UserMenu). */}
              <div className="flex items-center justify-between gap-3 px-4 py-1.5 md:px-6">
                <div className="md:hidden">
                  <Logo size="sm" showWordmark={false} />
                </div>
                <div className="hidden md:block">
                  <PageTitleSlot />
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {user.role === "admin" && <SendNotificationButton />}
                  <NotificationBell userId={user.id} />
                  <UserMenu user={user} />
                </div>
              </div>
              <div className="border-t border-slate-100 px-2 py-2 md:hidden">
                <SidebarNav items={navItems} variant="horizontal" />
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </PageTitleProvider>
  );
}

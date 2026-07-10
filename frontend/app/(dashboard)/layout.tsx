import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ACCOUNT_ROLE_LABEL, type AccountRole } from "@/lib/types";
import { LogoutButton } from "@/components/logout-button";
import { Logo } from "@/components/logo";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { Avatar } from "@/components/ui/avatar";

const ALL_NAV_ITEMS: Array<NavItem & { roles: AccountRole[] }> = [
  { href: "/", label: "Trang chủ", icon: "home", roles: ["admin", "manager", "leader", "mkt", "sale"] },
  { href: "/candidates", label: "Ứng viên", icon: "candidates", roles: ["admin", "manager", "mkt", "leader", "sale"] },
  { href: "/calendar", label: "Lịch hẹn", icon: "calendar", roles: ["admin", "manager", "leader", "sale"] },
  { href: "/accounts", label: "Quản lý tài khoản", icon: "accounts", roles: ["admin"] },
  { href: "/teams", label: "Quản lý nhóm", icon: "teams", roles: ["admin"] },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const navItems = ALL_NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:bg-gradient-to-b md:from-brand-900 md:to-brand-950">
        <div className="px-5 py-5">
          <Logo variant="light" size="sm" />
        </div>
        <div className="mt-2 flex-1">
          <SidebarNav items={navItems} />
        </div>
        <div className="px-5 py-4 text-xs text-brand-200/50">Saram RMS · Nội bộ</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="md:hidden">
              <Logo size="sm" showWordmark={false} />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right text-sm leading-tight sm:block">
                <p className="font-medium text-slate-800">{user.full_name}</p>
                <p className="text-xs text-slate-500">
                  {ACCOUNT_ROLE_LABEL[user.role]}
                  {user.team_name ? ` · ${user.team_name}` : ""}
                </p>
              </div>
              <Avatar fullName={user.full_name} />
              <LogoutButton />
            </div>
          </div>
          <div className="border-t border-slate-100 px-2 py-2 md:hidden">
            <SidebarNav items={navItems} variant="horizontal" />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

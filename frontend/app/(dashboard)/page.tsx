import Link from "next/link";
import { Building2, UserCog, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { ACCOUNT_ROLE_LABEL, type AccountRole, type PaginatedResult } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const QUICK_LINKS = [
  {
    href: "/candidates",
    label: "Ứng viên",
    description: "Nhập, tìm kiếm và quản lý dữ liệu ứng viên.",
    icon: Users,
    roles: ["admin", "manager", "mkt", "leader", "sale"] as AccountRole[],
  },
  {
    href: "/accounts",
    label: "Quản lý tài khoản",
    description: "Tạo và phân quyền tài khoản nhân viên.",
    icon: UserCog,
    roles: ["admin"] as AccountRole[],
  },
  {
    href: "/teams",
    label: "Quản lý nhóm",
    description: "Tổ chức nhóm và phân công Leader phụ trách.",
    icon: Building2,
    roles: ["admin"] as AccountRole[],
  },
];

interface StatCard {
  label: string;
  value: number;
  icon: typeof Users;
  accent: "brand" | "accent" | "success";
}

const ACCENT_CLASSES: Record<StatCard["accent"], string> = {
  brand: "bg-brand-50 text-brand-700",
  accent: "bg-accent-50 text-accent-600",
  success: "bg-emerald-50 text-emerald-600",
};

/**
 * Phase 0: Tài khoản & Nhóm (Admin). Phase 1: Ứng viên (Admin/Quản lý/MKT).
 * Phase 2: mở thêm Ứng viên cho Leader/Sale (docs/14-roadmap.md).
 * Số liệu bên dưới lấy từ các API GET đã có sẵn (candidate/account/team),
 * không tạo API/nghiệp vụ mới — chỉ hiển thị lại tổng số cho đẹp mắt.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  const links = user ? QUICK_LINKS.filter((link) => link.roles.includes(user.role)) : [];

  const stats: StatCard[] = [];
  if (user && ["admin", "manager", "mkt"].includes(user.role)) {
    const candidates = await serverApi<PaginatedResult<unknown>>("/candidate?page=1&page_size=1");
    stats.push({ label: "Ứng viên", value: candidates.total, icon: Users, accent: "brand" });
  }
  if (user?.role === "admin") {
    const [accounts, teams] = await Promise.all([
      serverApi<PaginatedResult<unknown>>("/account?page=1&page_size=1"),
      serverApi<PaginatedResult<unknown>>("/team?page=1&page_size=1"),
    ]);
    stats.push({ label: "Tài khoản", value: accounts.total, icon: UserCog, accent: "accent" });
    stats.push({ label: "Nhóm", value: teams.total, icon: Building2, accent: "success" });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Xin chào, {user?.full_name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {user?.team_name ? `Nhóm: ${user.team_name}` : "Chào mừng quay lại với Saram RMS"}
            </p>
          </div>
          {user && <Badge variant="info">{ACCOUNT_ROLE_LABEL[user.role]}</Badge>}
        </div>
      </Card>

      {stats.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="flex items-center gap-4 p-5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ACCENT_CLASSES[stat.accent]}`}>
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value.toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className="group">
                <Card className="h-full p-5 transition-shadow group-hover:shadow-md group-hover:shadow-brand-900/10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-accent-50 group-hover:text-accent-600">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{link.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{link.description}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Các nghiệp vụ tiếp theo (phân chia, chăm sóc, phỏng vấn, dashboard...) sẽ có ở các giai đoạn phát triển sau.
      </p>
    </div>
  );
}

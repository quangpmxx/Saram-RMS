import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-zinc-900">
            Saram RMS
          </Link>
          {user.role === "admin" && (
            <nav className="flex items-center gap-4 text-sm text-zinc-600">
              <Link href="/accounts" className="hover:text-zinc-900">
                Quản lý tài khoản
              </Link>
              <Link href="/teams" className="hover:text-zinc-900">
                Quản lý nhóm
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-600">
            {user.full_name} · <span className="font-medium">{ACCOUNT_ROLE_LABEL[user.role]}</span>
            {user.team_name ? ` · ${user.team_name}` : ""}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 bg-zinc-50 p-6">{children}</main>
    </div>
  );
}

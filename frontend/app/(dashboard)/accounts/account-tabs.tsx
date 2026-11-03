import Link from "next/link";
import { cn } from "@/lib/cn";

/** Tab trong "Quản lý tài khoản": Tài khoản | Phân quyền (chỉ Admin). */
export function AccountTabs({ active, isAdmin }: { active: "accounts" | "permissions"; isAdmin: boolean }) {
  if (!isAdmin) return null;
  const tabs = [
    { key: "accounts", href: "/accounts", label: "Tài khoản" },
    { key: "permissions", href: "/accounts/permissions", label: "Phân quyền" },
  ] as const;
  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition",
            active === tab.key
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

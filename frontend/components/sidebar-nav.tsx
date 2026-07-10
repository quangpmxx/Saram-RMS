"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, LayoutDashboard, UserCog, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  home: LayoutDashboard,
  candidates: Users,
  accounts: UserCog,
  teams: Building2,
  calendar: CalendarDays,
} satisfies Record<string, LucideIcon>;

export type NavIconKey = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
}

export function SidebarNav({ items, variant = "vertical" }: { items: NavItem[]; variant?: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  if (variant === "horizontal") {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-r-lg border-l-[3px] py-2.5 pr-3 pl-3 text-sm font-medium transition-colors",
              active
                ? "border-accent-400 bg-white/10 text-white"
                : "border-transparent text-brand-100/75 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", active ? "text-accent-400" : "text-brand-200/60")} strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

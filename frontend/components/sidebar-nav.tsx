"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Copy,
  History,
  LayoutDashboard,
  Settings2,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  home: LayoutDashboard,
  candidates: Users,
  accounts: UserCog,
  teams: Building2,
  calendar: CalendarDays,
  reports: BarChart3,
  duplicates: Copy,
  auditLog: History,
  settings: Settings2,
} satisfies Record<string, LucideIcon>;

export type NavIconKey = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
}

export function SidebarNav({
  items,
  variant = "vertical",
  collapsed = false,
}: {
  items: NavItem[];
  variant?: "vertical" | "horizontal";
  collapsed?: boolean;
}) {
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
    <nav className={cn("flex flex-col px-3", collapsed ? "gap-2" : "gap-0.5")}>
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              active ? "bg-accent-500/20 text-white" : "text-brand-100/75 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon
              className={cn(
                "shrink-0 transition-[width,height]",
                collapsed ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]",
                active ? "text-accent-400" : "text-brand-200/60",
              )}
              strokeWidth={2}
            />
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-[opacity,max-width]",
                collapsed ? "max-w-0 opacity-0 duration-100" : "max-w-[160px] opacity-100 delay-150 duration-200",
              )}
            >
              {item.label}
            </span>

            {collapsed && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full z-30 ml-3 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity delay-300 group-hover:opacity-100"
              >
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, CalendarDays, CheckCheck, KanbanSquare, Lightbulb, LayoutDashboard, Target, type LucideIcon } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { useSetPageTitle } from "@/lib/page-title-context";
import { cn } from "@/lib/cn";
import type { MediaOptions } from "./media-shared";
import { MediaDashboard } from "./media-dashboard";
import { MediaPlans } from "./media-plans";
import { MediaTasks } from "./media-tasks";
import { MediaReviews } from "./media-reviews";
import { MediaIdeas } from "./media-ideas";
import { MediaCalendar } from "./media-calendar";
import { MediaReport } from "./media-report";

type TabKey = "dashboard" | "plans" | "tasks" | "reviews" | "ideas" | "calendar" | "report";

const TABS: { key: TabKey; label: string; icon: LucideIcon; tint: string }[] = [
  { key: "dashboard", label: "Tổng quan", icon: LayoutDashboard, tint: "from-violet-500 to-fuchsia-500" },
  { key: "plans", label: "Kế hoạch", icon: Target, tint: "from-blue-500 to-violet-500" },
  { key: "tasks", label: "Công việc", icon: KanbanSquare, tint: "from-sky-500 to-blue-600" },
  { key: "reviews", label: "Duyệt sản phẩm", icon: CheckCheck, tint: "from-fuchsia-500 to-pink-500" },
  { key: "ideas", label: "Ý tưởng & kịch bản", icon: Lightbulb, tint: "from-amber-400 to-orange-500" },
  { key: "calendar", label: "Lịch xuất bản", icon: CalendarDays, tint: "from-pink-500 to-rose-500" },
  { key: "report", label: "Báo cáo hiệu quả", icon: BarChart3, tint: "from-emerald-500 to-teal-500" },
];

/**
 * Khung trang Media: hero gradient + thanh tab (tab lưu trên URL `?tab=` để
 * thông báo chuông mở đúng chỗ, vd `?tab=tasks&task=<id>`).
 */
export function MediaClient({ canEdit, initialOptions }: { canEdit: boolean; initialOptions: MediaOptions }) {
  useSetPageTitle("Media", "Creative Studio — kế hoạch, sản xuất, duyệt và đo hiệu quả nội dung tuyển dụng");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? tabParam! : "dashboard";
  const openTaskId = searchParams.get("task");
  const [options, setOptions] = useState(initialOptions);

  const go = useCallback(
    (next: TabKey, extra?: Record<string, string>) => {
      const params = new URLSearchParams({ tab: next, ...extra });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const reloadOptions = useCallback(() => {
    clientApi<MediaOptions>("/media/options").then(setOptions).catch(() => undefined);
  }, []);

  const openTask = useCallback((id: string) => go("tasks", { task: id }), [go]);
  const closeTask = useCallback(() => go("tasks"), [go]);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 p-5 text-white shadow-lg shadow-fuchsia-500/20 sm:p-6">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">Saram Creative Studio</p>
          <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Media 🎬</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/85">Lên kế hoạch, giao việc, duyệt sản phẩm và theo dõi hiệu quả từ lượt xem tới người nhận việc.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => go(t.key)}
              className={cn(
                "group inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200",
                active ? "bg-white text-slate-900 shadow-md shadow-violet-500/15 ring-1 ring-violet-200" : "text-slate-500 hover:-translate-y-0.5 hover:bg-white hover:text-slate-800",
              )}
            >
              <span className={cn("grid size-6 place-items-center rounded-lg bg-gradient-to-br text-white transition-transform group-hover:scale-110", t.tint)}>
                <Icon className="size-3.5" />
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && <MediaDashboard onOpenTask={openTask} />}
      {tab === "plans" && <MediaPlans options={options} canEdit={canEdit} onOptionsChanged={reloadOptions} />}
      {tab === "tasks" && <MediaTasks options={options} canEdit={canEdit} openTaskId={openTaskId} onOpenTask={openTask} onCloseTask={closeTask} />}
      {tab === "reviews" && <MediaReviews options={options} canEdit={canEdit} onOpenTask={openTask} />}
      {tab === "ideas" && <MediaIdeas options={options} canEdit={canEdit} />}
      {tab === "calendar" && <MediaCalendar options={options} canEdit={canEdit} />}
      {tab === "report" && <MediaReport options={options} />}
    </div>
  );
}

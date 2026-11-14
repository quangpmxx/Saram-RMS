"use client";

import { useEffect, useState } from "react";
import { AlarmClock, CheckCircle2, Eye, Layers, Loader2, PlayCircle, TimerOff, type LucideIcon } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import {
  PersonChip,
  PriorityBadge,
  SectionTitle,
  StatusBadge,
  StudioCard,
  TYPE_EMOJI,
  fmtDeadline,
  relativeDeadline,
  type Person,
  type Priority,
  type TaskStatus,
} from "./media-shared";

interface DashboardData {
  scope: "all" | "mine";
  counts: Record<TaskStatus | "total" | "overdue", number>;
  pending_review: number;
  by_staff: { person: Person; done: number; active: number; overdue: number; video: number; post: number; livestream: number; other: number }[];
  weekly: { key: string; done: number; created: number }[];
  monthly: { key: string; done: number; created: number }[];
  upcoming: { id: string; code: string; title: string; type: string; status: TaskStatus; priority: Priority; deadline: string; overdue: boolean; assignee: Person | null }[];
}

const KPIS: { key: keyof DashboardData["counts"] | "pending_review"; label: string; icon: LucideIcon; grad: string }[] = [
  { key: "total", label: "Tổng công việc", icon: Layers, grad: "from-violet-500 to-indigo-500" },
  { key: "in_progress", label: "Đang thực hiện", icon: PlayCircle, grad: "from-sky-400 to-blue-600" },
  { key: "pending_review", label: "Chờ duyệt", icon: Eye, grad: "from-fuchsia-500 to-pink-500" },
  { key: "done", label: "Hoàn thành", icon: CheckCircle2, grad: "from-emerald-400 to-teal-500" },
  { key: "overdue", label: "Quá hạn", icon: TimerOff, grad: "from-orange-400 to-rose-500" },
];

export function MediaDashboard({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");

  useEffect(() => {
    clientApi<DashboardData>("/media/dashboard")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <StudioCard className="text-sm text-red-600">{error}</StudioCard>;
  if (!data)
    return (
      <div className="grid place-items-center py-16 text-slate-400">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );

  const series = data[range];
  const maxBar = Math.max(1, ...series.flatMap((s) => [s.done, s.created]));
  const maxStaff = Math.max(1, ...data.by_staff.map((s) => s.done + s.active));

  return (
    <div className="space-y-4">
      {data.scope === "mine" && <p className="text-xs text-slate-500">Số liệu các công việc bạn phụ trách / tham gia.</p>}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPIS.map((k) => {
          const Icon = k.icon;
          const value = k.key === "pending_review" ? data.pending_review : data.counts[k.key];
          return (
            <div key={k.key} className={cn("group relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md transition-transform duration-200 hover:-translate-y-1", k.grad)}>
              <div className="absolute -right-6 -bottom-6 size-24 rounded-full bg-white/15 transition-transform duration-300 group-hover:scale-125" />
              <Icon className="relative size-5 opacity-90" />
              <p className="relative mt-3 text-3xl font-extrabold tabular-nums">{value}</p>
              <p className="relative text-xs font-medium text-white/85">{k.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Biểu đồ hiệu suất */}
        <StudioCard className="lg:col-span-3">
          <SectionTitle
            title="Hiệu suất sản xuất"
            hint="Việc hoàn thành và việc mới tạo"
            action={
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                {(["weekly", "monthly"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setRange(r)} className={cn("rounded-md px-2.5 py-1 transition-colors", range === r ? "bg-white text-violet-700 shadow-sm" : "text-slate-500")}>
                    {r === "weekly" ? "8 tuần" : "6 tháng"}
                  </button>
                ))}
              </div>
            }
          />
          <div className="flex h-52 items-end gap-2 sm:gap-3">
            {series.map((s) => (
              <div key={s.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div title={`Hoàn thành: ${s.done}`} className="w-1/2 max-w-5 rounded-t-md bg-gradient-to-t from-violet-600 to-fuchsia-400 transition-all duration-500" style={{ height: `${(s.done / maxBar) * 100}%`, minHeight: s.done ? 4 : 0 }} />
                  <div title={`Tạo mới: ${s.created}`} className="w-1/2 max-w-5 rounded-t-md bg-gradient-to-t from-orange-400 to-amber-300 transition-all duration-500" style={{ height: `${(s.created / maxBar) * 100}%`, minHeight: s.created ? 4 : 0 }} />
                </div>
                <span className="truncate text-[10px] text-slate-500 tabular-nums">{range === "weekly" ? s.key.slice(8, 10) + "/" + s.key.slice(5, 7) : "T" + Number(s.key.slice(5, 7))}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-violet-500" />Hoàn thành</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-orange-400" />Tạo mới</span>
          </div>
        </StudioCard>

        {/* Sắp đến hạn */}
        <StudioCard className="lg:col-span-2">
          <SectionTitle title="Sắp đến deadline" hint="Trong 7 ngày tới và đã quá hạn" />
          {data.upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Không có việc gấp 🎉</p>
          ) : (
            <ul className="space-y-2">
              {data.upcoming.map((t) => {
                const rel = relativeDeadline(t.deadline);
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => onOpenTask(t.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-2.5 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/50">
                      <span className="text-xl">{TYPE_EMOJI[t.type] ?? "✨"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{t.title}</span>
                        <span className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{t.code}</span>
                          <PersonChip person={t.assignee} size="xs" />
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold", rel?.tone === "late" ? "text-rose-600" : rel?.tone === "soon" ? "text-orange-600" : "text-slate-500")} title={fmtDeadline(t.deadline)}>
                          <AlarmClock className="size-3" />
                          {rel?.text}
                        </span>
                        <PriorityBadge priority={t.priority} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </StudioCard>
      </div>

      {/* Sản lượng theo nhân viên */}
      <StudioCard>
        <SectionTitle title="Sản lượng theo nhân viên" hint="Theo người phụ trách chính — đã xong / đang làm" />
        {data.by_staff.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Chưa có công việc nào được giao.</p>
        ) : (
          <div className="space-y-3">
            {data.by_staff.map((s) => (
              <div key={s.person.id} className="grid items-center gap-2 sm:grid-cols-[180px_1fr_auto]">
                <PersonChip person={s.person} />
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${(s.done / maxStaff) * 100}%` }} title={`Đã xong ${s.done}`} />
                  <div className="bg-sky-300" style={{ width: `${(s.active / maxStaff) * 100}%` }} title={`Đang làm ${s.active}`} />
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600">
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">✓ {s.done}</span>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">⏳ {s.active}</span>
                  {s.overdue > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">⚠ {s.overdue}</span>}
                  <span className="text-slate-400">🎬{s.video} 📝{s.post} 🔴{s.livestream}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </StudioCard>

      {/* Phân bổ trạng thái */}
      <StudioCard>
        <SectionTitle title="Phân bổ trạng thái" />
        <div className="flex flex-wrap gap-2">
          {(["todo", "in_progress", "in_review", "revision", "done"] as TaskStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-2">
              <StatusBadge status={s} />
              <span className="text-sm font-bold text-slate-700 tabular-nums">{data.counts[s]}</span>
            </span>
          ))}
        </div>
      </StudioCard>
    </div>
  );
}

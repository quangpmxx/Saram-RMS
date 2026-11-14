"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlarmClock, KanbanSquare, List, Loader2, Plus, Search } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { useRememberedFilters } from "@/lib/remembered-filters";
import { cn } from "@/lib/cn";
import {
  AvatarStack,
  PersonChip,
  PlatformChip,
  PriorityBadge,
  ProgressBar,
  STATUS_META,
  STATUS_ORDER,
  StatusBadge,
  StudioCard,
  TYPE_EMOJI,
  TYPE_LABEL,
  fmtDeadline,
  relativeDeadline,
  type MediaOptions,
  type MediaTask,
  type TaskStatus,
} from "./media-shared";
import { TaskFormModal } from "./media-task-form";
import { TaskDetailModal } from "./media-task-detail";

interface Filters {
  q: string;
  assignee_id: string;
  campaign_id: string;
  mine: string;
  view: string;
}
const EMPTY: Filters = { q: "", assignee_id: "", campaign_id: "", mine: "", view: "kanban" };

export function MediaTasks({
  options,
  canEdit,
  openTaskId,
  onOpenTask,
  onCloseTask,
}: {
  options: MediaOptions;
  canEdit: boolean;
  openTaskId: string | null;
  onOpenTask: (id: string) => void;
  onCloseTask: () => void;
}) {
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  useRememberedFilters("media-tasks", filters, (saved) => setFilters({ ...EMPTY, ...saved }));
  const [tasks, setTasks] = useState<MediaTask[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<TaskStatus | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.q.trim()) p.set("q", filters.q.trim());
    if (filters.assignee_id) p.set("assignee_id", filters.assignee_id);
    if (filters.campaign_id) p.set("campaign_id", filters.campaign_id);
    if (filters.mine) p.set("mine", "1");
    clientApi<MediaTask[]>(`/media/tasks?${p.toString()}`)
      .then(setTasks)
      .catch((e: Error) => toast.error(e.message));
  }, [filters.q, filters.assignee_id, filters.campaign_id, filters.mine, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, MediaTask[]>(STATUS_ORDER.map((s) => [s, []]));
    for (const t of tasks ?? []) map.get(t.status)!.push(t);
    return map;
  }, [tasks]);

  const moveTo = async (id: string, status: TaskStatus) => {
    const task = tasks?.find((t) => t.id === id);
    if (!task || task.status === status) return;
    try {
      await clientApi(`/media/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(`${task.code} → ${STATUS_META[status].label}`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      {/* Thanh lọc */}
      <StudioCard className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input uiSize="sm" className="pl-8" placeholder="Tìm tên, nhà máy, mã MD-..." value={filters.q} onChange={(e) => set("q", e.target.value)} />
        </div>
        <Select uiSize="sm" className="w-auto" value={filters.assignee_id} onChange={(e) => set("assignee_id", e.target.value)}>
          <option value="">Mọi nhân viên</option>
          {options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select uiSize="sm" className="w-auto" value={filters.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}>
          <option value="">Mọi chiến dịch</option>
          {options.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <input type="checkbox" className="accent-violet-600" checked={!!filters.mine} onChange={(e) => set("mine", e.target.checked ? "1" : "")} />
          Việc của tôi
        </label>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {[{ k: "kanban", icon: KanbanSquare, label: "Kanban" }, { k: "table", icon: List, label: "Bảng" }].map(({ k, icon: Icon, label }) => (
              <button key={k} type="button" title={label} onClick={() => set("view", k)} className={cn("rounded-md p-1.5 transition-colors", filters.view === k ? "bg-white text-violet-700 shadow-sm" : "text-slate-500")}>
                <Icon className="size-4" />
              </button>
            ))}
          </div>
          {canEdit && options.me.can_assign && (
            <Button size="sm" onClick={() => setCreating(true)} className="bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-fuchsia-500/30 hover:opacity-90">
              <Plus className="mr-1 inline size-4" />Giao việc
            </Button>
          )}
        </div>
      </StudioCard>

      {!tasks ? (
        <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="size-6 animate-spin" /></div>
      ) : filters.view === "table" ? (
        <TaskTable tasks={tasks} onOpen={onOpenTask} />
      ) : (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const list = byStatus.get(status) ?? [];
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setDropCol(status);
                }}
                onDragLeave={() => setDropCol((c) => (c === status ? null : c))}
                onDrop={() => {
                  if (dragId) void moveTo(dragId, status);
                  setDragId(null);
                  setDropCol(null);
                }}
                className={cn("flex w-72 shrink-0 snap-start flex-col rounded-2xl bg-slate-100/70 p-2 transition-colors", dropCol === status && "bg-violet-100 ring-2 ring-violet-300")}
              >
                <div className={cn("mb-2 flex items-center justify-between rounded-xl bg-gradient-to-r px-3 py-2 text-white shadow-sm", meta.column)}>
                  <span className="text-sm font-bold">{meta.label}</span>
                  <span className="rounded-full bg-white/25 px-2 text-xs font-bold">{list.length}</span>
                </div>
                <div className="flex min-h-24 flex-col gap-2">
                  {list.map((t) => (
                    <TaskCard key={t.id} task={t} draggable={canEdit} onOpen={() => onOpenTask(t.id)} onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} />
                  ))}
                  {list.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Trống</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <TaskFormModal
          options={options}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {openTaskId && <TaskDetailModal taskId={openTaskId} options={options} canEdit={canEdit} onClose={onCloseTask} onChanged={load} />}
    </div>
  );
}

function TaskCard({ task, draggable, onOpen, onDragStart, onDragEnd }: { task: MediaTask; draggable: boolean; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const rel = relativeDeadline(task.deadline);
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "group w-full rounded-xl border border-white bg-white p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/10",
        task.overdue && "border-rose-200 ring-1 ring-rose-200",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-400">{TYPE_EMOJI[task.type]} {task.code}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800 group-hover:text-violet-700">{task.title}</p>
      {(task.factory || task.campaign) && <p className="mt-0.5 truncate text-[11px] text-slate-500">{[task.campaign?.name, task.factory].filter(Boolean).join(" · ")}</p>}
      <ProgressBar value={task.progress} className="mt-2" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <PersonChip person={task.assignee} size="xs" />
          {task.members.length > 0 && <AvatarStack people={task.members} max={2} />}
        </span>
        {rel && (
          <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold", rel.tone === "late" ? "text-rose-600" : rel.tone === "soon" ? "text-orange-600" : "text-slate-400")}>
            <AlarmClock className="size-3" />{rel.text}
          </span>
        )}
      </div>
      {task.platform && <div className="mt-2"><PlatformChip platform={task.platform} /></div>}
    </button>
  );
}

function TaskTable({ tasks, onOpen }: { tasks: MediaTask[]; onOpen: (id: string) => void }) {
  if (!tasks.length) return <StudioCard className="py-10 text-center text-sm text-slate-400">Không có công việc nào.</StudioCard>;
  return (
    <StudioCard className="overflow-x-auto p-0">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-gradient-to-r from-violet-50 to-pink-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
            <th className="px-3 py-2.5">Mã</th>
            <th className="px-3 py-2.5">Nội dung</th>
            <th className="px-3 py-2.5">Loại</th>
            <th className="px-3 py-2.5">Phụ trách</th>
            <th className="px-3 py-2.5">Trạng thái</th>
            <th className="px-3 py-2.5">Ưu tiên</th>
            <th className="px-3 py-2.5">Deadline</th>
            <th className="px-3 py-2.5">Tiến độ</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-violet-50/40">
              <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap text-slate-400">{t.code}</td>
              <td className="max-w-72 px-3 py-2.5">
                <p className="truncate font-semibold text-slate-800">{t.title}</p>
                <p className="truncate text-[11px] text-slate-500">{[t.campaign?.name, t.company_name, t.factory].filter(Boolean).join(" · ")}</p>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">{TYPE_EMOJI[t.type]} {TYPE_LABEL[t.type] ?? t.type}</td>
              <td className="px-3 py-2.5"><PersonChip person={t.assignee} size="xs" /></td>
              <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
              <td className="px-3 py-2.5"><PriorityBadge priority={t.priority} /></td>
              <td className={cn("px-3 py-2.5 text-xs whitespace-nowrap", t.overdue ? "font-bold text-rose-600" : "text-slate-600")}>{fmtDeadline(t.deadline)}</td>
              <td className="w-32 px-3 py-2.5"><ProgressBar value={t.progress} /><span className="text-[10px] text-slate-400">{t.progress}%</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </StudioCard>
  );
}

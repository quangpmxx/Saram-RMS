"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, MoreHorizontal, Plus, Settings2, StickyNote, Trash2, Maximize2 } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { useRememberedFilters } from "@/lib/remembered-filters";
import { shuttleColorStyle } from "@/lib/shuttle-colors";
import { cn } from "@/lib/cn";
import { StudioCard, ymd, type MediaOptions, type Person } from "./media-shared";
import { VideoCatalogModal } from "./media-video-catalog";

export interface VideoCatalog {
  groups: { id: string; name: string; color_key: string | null; sort_order: number }[];
  channels: { id: string; name: string; platform: string; url: string | null; color_key: string | null; active: boolean; owner: Person | null }[];
}

interface VideoRow {
  id: string;
  code: string;
  title: string;
  work_date: string;
  group: { id: string; name: string; color_key: string | null } | null;
  shooter: Person | null;
  editor: Person | null;
  raw_link: string | null;
  done_link: string | null;
  status: "todo" | "in_progress" | "in_review" | "revision" | "done";
  note: string | null;
  channel: { id: string; name: string; color_key: string | null; platform: string } | null;
  posted: boolean;
  post_date: string | null;
  can_edit: boolean;
}

type Patch = Partial<{
  work_date: string;
  content_group_id: string | null;
  shooter_id: string | null;
  editor_id: string | null;
  raw_link: string | null;
  done_link: string | null;
  status: "todo" | "in_progress" | "done";
  note: string | null;
  channel_id: string | null;
  posted: boolean;
}>;

const STATUS: Record<VideoRow["status"], { label: string; cls: string }> = {
  todo: { label: "Chưa dựng", cls: "bg-slate-100 text-slate-600" },
  in_progress: { label: "Đang dựng", cls: "bg-sky-100 text-sky-700" },
  in_review: { label: "Chờ duyệt", cls: "bg-violet-100 text-violet-700" },
  revision: { label: "Cần sửa", cls: "bg-orange-100 text-orange-700" },
  done: { label: "Xong", cls: "bg-emerald-100 text-emerald-700" },
};

const WEEKDAY = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

/** Ô chọn gọn: trông như chữ/nhãn, bấm vào là danh sách chọn của máy (dễ dùng cả trên điện thoại). */
function CellSelect({
  value,
  onChange,
  disabled,
  className,
  style,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={style}
      className={cn(
        "max-w-full cursor-pointer appearance-none truncate rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium outline-none hover:bg-slate-100 focus:ring-2 focus:ring-violet-300 disabled:cursor-default disabled:hover:bg-transparent",
        !value && "text-slate-300",
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

/** Ô link: có link → nút "Mở" nhỏ; bấm bút/ô trống → gõ link, Enter lưu, Esc huỷ. */
function LinkCell({ value, disabled, onSave, label }: { value: string | null; disabled: boolean; onSave: (v: string | null) => void; label: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (editing) {
    const commit = () => {
      setEditing(false);
      const v = text.trim() || null;
      if (v !== value) onSave(v);
    };
    return (
      <input
        ref={ref}
        value={text}
        placeholder="Dán link..."
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setText(value ?? "");
            setEditing(false);
          }
        }}
        className="w-full min-w-28 rounded-lg border border-violet-300 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-violet-300"
      />
    );
  }
  if (!value) {
    return disabled ? (
      <span className="px-2 text-xs text-slate-300">—</span>
    ) : (
      <button type="button" onClick={() => { setText(""); setEditing(true); }} className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-slate-100 hover:text-violet-600">
        + link
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <a href={value} target="_blank" rel="noreferrer" title={value} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">
        <ExternalLink className="size-3" />
        {label}
      </a>
      {!disabled && (
        <button type="button" title="Sửa link" onClick={() => { setText(value); setEditing(true); }} className="rounded px-1 text-[10px] text-slate-300 hover:text-violet-600">
          sửa
        </button>
      )}
    </span>
  );
}

/** Sổ video: nhập nhanh từng video theo ngày, giống sheet nhưng gọn hơn. */
export function MediaVideos({ options, canEdit, onOpenTask }: { options: MediaOptions; canEdit: boolean; onOpenTask: (id: string) => void }) {
  const toast = useToast();
  const [filters, setFilters] = useState({ month: ymd(new Date()).slice(0, 7), person_id: "", group_id: "", open: "" });
  useRememberedFilters("media-videos", filters, (saved) => setFilters((f) => ({ ...f, ...saved })));
  const [rows, setRows] = useState<VideoRow[] | null>(null);
  const [catalog, setCatalog] = useState<VideoCatalog>({ groups: [], channels: [] });
  const [showCatalog, setShowCatalog] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<VideoRow | null>(null);

  const loadCatalog = useCallback(() => {
    clientApi<VideoCatalog>("/media/video-catalog").then(setCatalog).catch(() => undefined);
  }, []);
  useEffect(loadCatalog, [loadCatalog]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ month: filters.month });
    if (filters.person_id) p.set("person_id", filters.person_id);
    if (filters.group_id) p.set("group_id", filters.group_id);
    if (filters.open) p.set("open", "1");
    clientApi<{ rows: VideoRow[] }>(`/media/videos?${p.toString()}`)
      .then((r) => setRows(r.rows))
      .catch((e: Error) => toast.error(e.message));
  }, [filters, toast]);
  useEffect(load, [load]);

  const byDate = useMemo(() => {
    const map = new Map<string, VideoRow[]>();
    for (const r of rows ?? []) map.set(r.work_date, [...(map.get(r.work_date) ?? []), r]);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const patch = async (row: VideoRow, body: Patch) => {
    try {
      const updated = await clientApi<VideoRow>(`/media/videos/${row.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setRows((list) => (list ?? []).map((r) => (r.id === row.id ? updated : r)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const add = async (date: string) => {
    try {
      const created = await clientApi<VideoRow>("/media/videos", { method: "POST", body: JSON.stringify({ work_date: date }) });
      if (created.work_date.slice(0, 7) !== filters.month) {
        setFilters((f) => ({ ...f, month: created.work_date.slice(0, 7) }));
      } else {
        setRows((list) => [created, ...(list ?? [])]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (row: VideoRow) => {
    setMenuFor(null);
    if (!confirm("Xoá dòng video này?")) return;
    try {
      await clientApi(`/media/videos/${row.id}`, { method: "DELETE" });
      setRows((list) => (list ?? []).filter((r) => r.id !== row.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = filters.month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setFilters((f) => ({ ...f, month: ymd(d).slice(0, 7) }));
  };

  const today = ymd(new Date());
  const [y, m] = filters.month.split("-").map(Number);
  const total = rows?.length ?? 0;
  const done = rows?.filter((r) => r.status === "done").length ?? 0;
  const posted = rows?.filter((r) => r.posted).length ?? 0;
  const activeChannels = catalog.channels.filter((c) => c.active);

  return (
    <div className="space-y-3">
      {/* Thanh công cụ */}
      <StudioCard className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center">
          <button type="button" className="rounded-lg p-1.5 hover:bg-slate-100" onClick={() => shiftMonth(-1)}><ChevronLeft className="size-5" /></button>
          <span className="min-w-28 text-center text-sm font-extrabold text-slate-800">Tháng {m}/{y}</span>
          <button type="button" className="rounded-lg p-1.5 hover:bg-slate-100" onClick={() => shiftMonth(1)}><ChevronRight className="size-5" /></button>
        </div>
        <Select uiSize="sm" className="w-auto" value={filters.person_id} onChange={(e) => setFilters((f) => ({ ...f, person_id: e.target.value }))}>
          <option value="">Mọi người</option>
          {options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select uiSize="sm" className="w-auto" value={filters.group_id} onChange={(e) => setFilters((f) => ({ ...f, group_id: e.target.value }))}>
          <option value="">Mọi nhóm</option>
          {catalog.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <input type="checkbox" className="accent-violet-600" checked={!!filters.open} onChange={(e) => setFilters((f) => ({ ...f, open: e.target.checked ? "1" : "" }))} />
          Chưa xong / chưa đăng
        </label>
        <span className="hidden text-xs text-slate-500 lg:inline">
          {total} video · <b className="text-emerald-600">{done}</b> xong · <b className="text-pink-600">{posted}</b> đã đăng
        </span>
        <div className="ml-auto flex items-center gap-2">
          {options.me.can_manage_plan && (
            <Button size="sm" variant="outline" onClick={() => setShowCatalog(true)}>
              <Settings2 className="mr-1 inline size-4" />Nhóm & kênh
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => add(today)} className="bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-fuchsia-500/30 hover:opacity-90">
              <Plus className="mr-1 inline size-4" />Thêm video
            </Button>
          )}
        </div>
      </StudioCard>

      {!rows ? (
        <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="size-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <StudioCard className="py-12 text-center text-sm text-slate-400">
          Chưa có video nào trong tháng này.
          {canEdit && <div className="mt-3"><Button size="sm" variant="outline" onClick={() => add(today)}><Plus className="mr-1 inline size-4" />Thêm video đầu tiên</Button></div>}
        </StudioCard>
      ) : (
        <StudioCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                <th className="w-36 px-3 py-2.5">Nhóm</th>
                <th className="px-3 py-2.5">Người quay</th>
                <th className="px-3 py-2.5">Người dựng</th>
                <th className="px-3 py-2.5">Video thô</th>
                <th className="px-3 py-2.5">Video xong</th>
                <th className="px-3 py-2.5">Trạng thái</th>
                <th className="px-3 py-2.5">Kênh đăng</th>
                <th className="px-3 py-2.5">Đăng</th>
                <th className="w-10" />
              </tr>
            </thead>
            {byDate.map(([date, list]) => {
              const d = new Date(`${date}T00:00:00`);
              return (
                <tbody key={date}>
                  <tr className="bg-gradient-to-r from-violet-50/80 to-transparent">
                    <td colSpan={9} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-bold", date === today ? "text-violet-700" : "text-slate-600")}>
                          {WEEKDAY[d.getDay()]}, {date.slice(8, 10)}/{date.slice(5, 7)}
                          {date === today && " · Hôm nay"}
                        </span>
                        <span className="text-[11px] text-slate-400">{list.length} video</span>
                        {canEdit && (
                          <button type="button" onClick={() => add(date)} className="ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold text-violet-600 hover:bg-violet-100">
                            + Thêm
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {list.map((r) => {
                    const ro = !canEdit || !r.can_edit;
                    const inReview = r.status === "in_review" || r.status === "revision";
                    return (
                      <tr key={r.id} className="group border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                        <td className="px-2 py-1.5">
                          <CellSelect
                            value={r.group?.id ?? ""}
                            disabled={ro}
                            placeholder="Chọn nhóm"
                            onChange={(v) => patch(r, { content_group_id: v || null })}
                            style={shuttleColorStyle(r.group?.color_key)}
                            className={cn(r.group && "rounded-full px-2.5 font-bold", r.group && !r.group.color_key && "bg-slate-100 text-slate-700")}
                          >
                            {catalog.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </CellSelect>
                        </td>
                        <td className="px-2 py-1.5">
                          <CellSelect value={r.shooter?.id ?? ""} disabled={ro} placeholder="—" onChange={(v) => patch(r, { shooter_id: v || null })} className="text-slate-700">
                            {options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </CellSelect>
                        </td>
                        <td className="px-2 py-1.5">
                          <CellSelect value={r.editor?.id ?? ""} disabled={ro} placeholder="—" onChange={(v) => patch(r, { editor_id: v || null })} className="text-slate-700">
                            {options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </CellSelect>
                        </td>
                        <td className="px-2 py-1.5"><LinkCell value={r.raw_link} disabled={ro} label="Thô" onSave={(v) => patch(r, { raw_link: v })} /></td>
                        <td className="px-2 py-1.5"><LinkCell value={r.done_link} disabled={ro} label="Xem" onSave={(v) => patch(r, { done_link: v })} /></td>
                        <td className="px-2 py-1.5">
                          {inReview ? (
                            <button type="button" onClick={() => onOpenTask(r.id)} className={cn("rounded-full px-2.5 py-1 text-xs font-bold", STATUS[r.status].cls)}>{STATUS[r.status].label}</button>
                          ) : (
                            <select
                              value={r.status}
                              disabled={ro}
                              onChange={(e) => patch(r, { status: e.target.value as Patch["status"] })}
                              className={cn("cursor-pointer appearance-none rounded-full border-0 px-2.5 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-default", STATUS[r.status].cls)}
                            >
                              <option value="todo">Chưa dựng</option>
                              <option value="in_progress">Đang dựng</option>
                              <option value="done">Xong</option>
                            </select>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <CellSelect
                            value={r.channel?.id ?? ""}
                            disabled={ro}
                            placeholder="Chọn kênh"
                            onChange={(v) => patch(r, { channel_id: v || null })}
                            style={shuttleColorStyle(r.channel?.color_key)}
                            className={cn(r.channel && "rounded-full px-2.5 font-semibold", r.channel && !r.channel.color_key && "bg-pink-50 text-pink-700")}
                          >
                            {r.channel && !activeChannels.some((c) => c.id === r.channel!.id) && <option value={r.channel.id}>{r.channel.name}</option>}
                            {activeChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </CellSelect>
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            disabled={ro}
                            onClick={() => patch(r, { posted: !r.posted })}
                            title={r.posted ? "Bấm để bỏ đánh dấu đã đăng" : "Bấm khi đã đăng"}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors disabled:cursor-default",
                              r.posted ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white" : "border border-dashed border-slate-300 text-slate-400 hover:border-pink-400 hover:text-pink-600",
                            )}
                          >
                            {r.posted ? `✓ ${r.post_date ? `${r.post_date.slice(8, 10)}/${r.post_date.slice(5, 7)}` : "Đã đăng"}` : "Chưa đăng"}
                          </button>
                        </td>
                        <td className="relative px-1 py-1.5">
                          <div className="flex items-center">
                            {r.note && (
                              <button type="button" title={r.note} onClick={() => setNoteFor(r)} className="rounded p-1 text-amber-500 hover:bg-amber-50"><StickyNote className="size-4" /></button>
                            )}
                            <button type="button" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} className="rounded p-1 text-slate-300 group-hover:text-slate-500 hover:bg-slate-100"><MoreHorizontal className="size-4" /></button>
                          </div>
                          {menuFor === r.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                              <div className="absolute top-8 right-1 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
                                {!ro && <MenuItem icon={StickyNote} label={r.note ? "Sửa ghi chú" : "Thêm ghi chú"} onClick={() => { setMenuFor(null); setNoteFor(r); }} />}
                                <MenuItem icon={Maximize2} label="Mở chi tiết" onClick={() => { setMenuFor(null); onOpenTask(r.id); }} />
                                {!ro && <MenuItem icon={Trash2} label="Xoá dòng" danger onClick={() => remove(r)} />}
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </StudioCard>
      )}

      {noteFor && <NoteModal row={noteFor} readOnly={!canEdit || !noteFor.can_edit} onClose={() => setNoteFor(null)} onSave={(note) => { void patch(noteFor, { note }); setNoteFor(null); }} />}
      {showCatalog && (
        <VideoCatalogModal
          options={options}
          catalog={catalog}
          onClose={() => setShowCatalog(false)}
          onChanged={() => {
            loadCatalog();
            load();
          }}
        />
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Trash2; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50", danger ? "text-red-600" : "text-slate-700")}>
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function NoteModal({ row, readOnly, onClose, onSave }: { row: VideoRow; readOnly: boolean; onClose: () => void; onSave: (note: string | null) => void }) {
  const [text, setText] = useState(row.note ?? "");
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-sm font-bold text-slate-800">Ghi chú · {row.code}</p>
        <textarea autoFocus rows={4} readOnly={readOnly} value={text} onChange={(e) => setText(e.target.value)} placeholder="VD: Chưa đủ cảnh để dựng" className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>{readOnly ? "Đóng" : "Huỷ"}</Button>
          {!readOnly && <Button size="sm" onClick={() => onSave(text.trim() || null)}>Lưu</Button>}
        </div>
      </div>
    </div>
  );
}

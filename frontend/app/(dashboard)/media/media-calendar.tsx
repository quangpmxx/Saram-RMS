"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Plus } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { Chip, PLATFORMS, PLATFORM_META, PersonChip, PlatformChip, StudioCard, fmtNumber, ymd, type MediaOptions, type MediaTask, type Person } from "./media-shared";

export interface Publication {
  id: string;
  title: string;
  task: { id: string; code: string; title: string } | null;
  campaign: { id: string; name: string } | null;
  company_id: string | null;
  company_name: string | null;
  factory: string | null;
  scheduled_date: string;
  platform: string;
  channel: string | null;
  publisher: Person | null;
  status: "pending" | "published";
  link: string | null;
  published_at: string | null;
  note: string | null;
  metrics: Record<MetricKey, number>;
  metrics_source: string;
  metrics_updated_at: string | null;
  can_edit: boolean;
}

export type MetricKey = "views" | "interactions" | "shares" | "comments" | "inbox" | "candidates" | "interviews" | "hired";
export const METRICS: { key: MetricKey; label: string; emoji: string }[] = [
  { key: "views", label: "Lượt xem", emoji: "👀" },
  { key: "interactions", label: "Tương tác", emoji: "❤️" },
  { key: "shares", label: "Chia sẻ", emoji: "🔁" },
  { key: "comments", label: "Bình luận", emoji: "💬" },
  { key: "inbox", label: "Inbox", emoji: "📩" },
  { key: "candidates", label: "Ứng viên", emoji: "🙋" },
  { key: "interviews", label: "Phỏng vấn", emoji: "🤝" },
  { key: "hired", label: "Nhận việc", emoji: "🎉" },
];

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Lịch xuất bản theo tháng: bấm ngày để thêm, bấm bài để sửa / nhập số liệu. */
export function MediaCalendar({ options, canEdit }: { options: MediaOptions; canEdit: boolean }) {
  const toast = useToast();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rows, setRows] = useState<Publication[]>([]);
  const [editing, setEditing] = useState<Publication | { date: string } | null>(null);

  const days = useMemo(() => {
    const first = new Date(month);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const load = useCallback(() => {
    const from = ymd(days[0]);
    const to = ymd(days[days.length - 1]);
    clientApi<Publication[]>(`/media/publications?from=${from}&to=${to}`).then(setRows).catch((e: Error) => toast.error(e.message));
  }, [days, toast]);
  useEffect(load, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Publication[]>();
    for (const r of rows) map.set(r.scheduled_date, [...(map.get(r.scheduled_date) ?? []), r]);
    return map;
  }, [rows]);

  const today = ymd(new Date());
  const inMonth = rows.filter((r) => r.scheduled_date.slice(0, 7) === ymd(month).slice(0, 7));
  const published = inMonth.filter((r) => r.status === "published").length;

  return (
    <div className="space-y-3">
      <StudioCard className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-lg p-1.5 hover:bg-slate-100" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="size-5" /></button>
          <span className="min-w-36 text-center text-base font-extrabold text-slate-800">Tháng {month.getMonth() + 1}/{month.getFullYear()}</span>
          <button type="button" className="rounded-lg p-1.5 hover:bg-slate-100" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="size-5" /></button>
        </div>
        <Chip className="bg-emerald-50 text-emerald-700">✓ Đã đăng {published}</Chip>
        <Chip className="bg-amber-50 text-amber-700">⏳ Chưa đăng {inMonth.length - published}</Chip>
        {canEdit && (
          <Button size="sm" className="ml-auto bg-gradient-to-r from-pink-500 to-rose-500 shadow-pink-500/30 hover:opacity-90" onClick={() => setEditing({ date: today })}>
            <Plus className="mr-1 inline size-4" />Lên lịch đăng
          </Button>
        )}
      </StudioCard>

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => <div key={w} className="py-1 text-center text-xs font-bold text-slate-400">{w}</div>)}
          {days.map((d) => {
            const key = ymd(d);
            const list = byDay.get(key) ?? [];
            const other = d.getMonth() !== month.getMonth();
            return (
              <div
                key={key}
                onClick={() => canEdit && setEditing({ date: key })}
                className={cn(
                  "group min-h-28 rounded-xl border bg-white p-1.5 transition-colors",
                  other ? "border-transparent bg-slate-50/60 opacity-60" : "border-slate-200/80",
                  canEdit && "cursor-pointer hover:border-pink-300",
                  key === today && "ring-2 ring-pink-400",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn("grid size-6 place-items-center rounded-full text-xs font-bold", key === today ? "bg-gradient-to-br from-pink-500 to-orange-400 text-white" : "text-slate-500")}>{d.getDate()}</span>
                  {canEdit && <Plus className="size-3.5 text-pink-400 opacity-0 group-hover:opacity-100" />}
                </div>
                <div className="space-y-1">
                  {list.slice(0, 4).map((p) => {
                    const meta = PLATFORM_META[p.platform] ?? PLATFORM_META.other;
                    const Icon = meta.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(p);
                        }}
                        className={cn("flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold transition-transform hover:scale-[1.02]", meta.chip, p.status === "pending" && "opacity-70 ring-1 ring-amber-300 ring-offset-1")}
                        title={`${p.title} — ${p.status === "published" ? "Đã đăng" : "Chưa đăng"}`}
                      >
                        <Icon className="size-3 shrink-0" />
                        <span className="truncate">{p.status === "published" ? "✓ " : ""}{p.title}</span>
                      </button>
                    );
                  })}
                  {list.length > 4 && <p className="text-[10px] font-semibold text-slate-400">+{list.length - 4} bài</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <PublicationForm
          options={options}
          canEdit={canEdit}
          value={"id" in editing ? editing : null}
          defaultDate={"date" in editing ? editing.date : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

export function PublicationForm({
  options,
  canEdit,
  value,
  defaultDate,
  onClose,
  onSaved,
}: {
  options: MediaOptions;
  canEdit: boolean;
  value: Publication | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editable = canEdit && (!value || value.can_edit);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<MediaTask[]>([]);
  const [form, setForm] = useState({
    title: value?.title ?? "",
    task_id: value?.task?.id ?? "",
    scheduled_date: value?.scheduled_date ?? defaultDate ?? ymd(new Date()),
    platform: value?.platform ?? "tiktok",
    channel: value?.channel ?? "",
    publisher_id: value?.publisher?.id ?? (value ? "" : options.me.id),
    status: value?.status ?? "pending",
    link: value?.link ?? "",
    campaign_id: value?.campaign?.id ?? "",
    company_id: value?.company_id ?? "",
    factory: value?.factory ?? "",
    note: value?.note ?? "",
  });
  const [metrics, setMetrics] = useState<Record<MetricKey, number>>(value?.metrics ?? { views: 0, interactions: 0, shares: 0, comments: 0, inbox: 0, candidates: 0, interviews: 0, hired: 0 });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    clientApi<MediaTask[]>("/media/tasks").then(setTasks).catch(() => setTasks([]));
  }, []);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Nhập tiêu đề bài đăng");
    setSaving(true);
    try {
      const body = {
        ...form,
        task_id: form.task_id || null,
        publisher_id: form.publisher_id || null,
        campaign_id: form.campaign_id || null,
        company_id: form.company_id || null,
        factory: form.factory || null,
        channel: form.channel || null,
        link: form.link || null,
        note: form.note || null,
      };
      const res = await clientApi<{ id: string }>(value ? `/media/publications/${value.id}` : "/media/publications", { method: value ? "PUT" : "POST", body: JSON.stringify(body) });
      if (value || Object.values(metrics).some((n) => n > 0)) {
        await clientApi(`/media/publications/${res.id}/metrics`, { method: "PATCH", body: JSON.stringify(metrics) });
      }
      toast.success("Đã lưu lịch đăng");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!value || !confirm("Xoá bài đăng này khỏi lịch?")) return;
    try {
      await clientApi(`/media/publications/${value.id}`, { method: "DELETE" });
      toast.success("Đã xoá");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal
      title={value ? "Bài đăng" : "Lên lịch đăng bài 📅"}
      description={value && !value.can_edit ? "Bạn chỉ xem — chỉ người đăng / người tạo / người có quyền sửa mọi lịch đăng mới sửa được." : undefined}
      maxWidth="max-w-2xl"
      footer={
        <>
          {value && editable && <Button variant="danger" onClick={remove}>Xoá</Button>}
          <Button variant="outline" onClick={onClose}>{editable ? "Huỷ" : "Đóng"}</Button>
          {editable && <Button disabled={saving} onClick={save} className="bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-90">{saving ? "Đang lưu..." : "Lưu"}</Button>}
        </>
      }
    >
      <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
        <Field label="Tiêu đề *" className="sm:col-span-2"><Input value={form.title} maxLength={255} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Gắn công việc (Media ID)" className="sm:col-span-2">
          <Select
            value={form.task_id}
            onChange={(e) => {
              const t = tasks.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, task_id: e.target.value, title: f.title || t?.title || "", platform: t?.platform ?? f.platform }));
            }}
          >
            <option value="">— Không gắn —</option>
            {value?.task && !tasks.some((t) => t.id === value.task!.id) && <option value={value.task.id}>{value.task.code} · {value.task.title}</option>}
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.title}</option>)}
          </Select>
        </Field>
        <Field label="Ngày đăng"><Input type="date" value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} /></Field>
        <Field label="Nền tảng">
          <Select value={form.platform} onChange={(e) => set("platform", e.target.value)}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
          </Select>
        </Field>
        <Field label="Tài khoản / kênh đăng"><Input value={form.channel} maxLength={200} onChange={(e) => set("channel", e.target.value)} placeholder="VD: Page Saram Việc Làm" /></Field>
        <Field label="Người đăng">
          <Select value={form.publisher_id} onChange={(e) => set("publisher_id", e.target.value)}>
            <option value="">—</option>
            {options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Trạng thái">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="pending">Chưa đăng</option>
            <option value="published">Đã đăng</option>
          </Select>
        </Field>
        <Field label="Link bài viết">
          <Input value={form.link} maxLength={1000} onChange={(e) => set("link", e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Chiến dịch">
          <Select value={form.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}>
            <option value="">{form.task_id ? "— Theo công việc —" : "—"}</option>
            {options.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Công ty">
          <Select value={form.company_id} onChange={(e) => set("company_id", e.target.value)}>
            <option value="">{form.task_id ? "— Theo công việc —" : "—"}</option>
            {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Nhà máy"><Input value={form.factory} maxLength={200} onChange={(e) => set("factory", e.target.value)} /></Field>
        <Field label="Ghi chú" className="sm:col-span-2"><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></Field>

        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 p-3 sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">📊 Số liệu hiệu quả <span className="font-normal text-slate-500">(nhập tay)</span></p>
            {value?.link && <a href={value.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"><ExternalLink className="size-3" />Mở bài</a>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METRICS.map((m) => (
              <Field key={m.key} label={`${m.emoji} ${m.label}`} uiSize="sm">
                <Input uiSize="sm" type="number" min={0} value={metrics[m.key]} onChange={(e) => setMetrics((x) => ({ ...x, [m.key]: Math.max(0, Number(e.target.value) || 0) }))} />
              </Field>
            ))}
          </div>
          {value?.metrics_updated_at && <p className="mt-2 text-[11px] text-slate-500">Cập nhật lần cuối: {new Date(value.metrics_updated_at).toLocaleString("vi-VN")} · {fmtNumber(value.metrics.views)} lượt xem</p>}
        </div>
        {value?.publisher && <div className="sm:col-span-2"><PersonChip person={value.publisher} /> <PlatformChip platform={value.platform} /></div>}
      </fieldset>
    </Modal>
  );
}

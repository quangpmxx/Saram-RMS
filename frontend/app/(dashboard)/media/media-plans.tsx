"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { Chip, PLATFORMS, PLATFORM_META, PlatformChip, SectionTitle, StudioCard, dateOnly, fmtDate, ymd, type MediaOptions } from "./media-shared";

interface Plan {
  id: string;
  title: string;
  period_type: "day" | "week" | "month";
  start_date: string;
  end_date: string;
  company_id: string | null;
  company_name: string | null;
  factory: string | null;
  campaign: { id: string; name: string } | null;
  platforms: string[];
  note: string | null;
  targets: { video: number; post: number; livestream: number };
  planned: { video: number; post: number; livestream: number };
  done: { video: number; post: number; livestream: number };
  task_count: number;
}

interface Campaign {
  id: string;
  name: string;
  company_id: string | null;
  company_name: string | null;
  factory: string | null;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  active: boolean;
  task_count: number;
  publication_count: number;
}

const PERIOD: Record<Plan["period_type"], { label: string; chip: string }> = {
  day: { label: "Ngày", chip: "bg-pink-50 text-pink-700" },
  week: { label: "Tuần", chip: "bg-sky-50 text-sky-700" },
  month: { label: "Tháng", chip: "bg-violet-50 text-violet-700" },
};

const TARGETS = [
  { key: "video", label: "Video", emoji: "🎬", bar: "from-violet-500 to-fuchsia-500" },
  { key: "post", label: "Bài viết", emoji: "📝", bar: "from-sky-400 to-blue-600" },
  { key: "livestream", label: "Livestream", emoji: "🔴", bar: "from-orange-400 to-rose-500" },
] as const;

/** Kế hoạch nội dung (ngày/tuần/tháng) + chiến dịch tuyển dụng. */
export function MediaPlans({ options, canEdit, onOptionsChanged }: { options: MediaOptions; canEdit: boolean; onOptionsChanged: () => void }) {
  const toast = useToast();
  const manage = canEdit && options.me.can_manage_plan;
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [period, setPeriod] = useState<"" | Plan["period_type"]>("");
  const [editPlan, setEditPlan] = useState<Plan | "new" | null>(null);
  const [editCampaign, setEditCampaign] = useState<Campaign | "new" | null>(null);

  const load = useCallback(() => {
    Promise.all([clientApi<Plan[]>("/media/plans"), clientApi<Campaign[]>("/media/campaigns")])
      .then(([p, c]) => {
        setPlans(p);
        setCampaigns(c);
      })
      .catch((e: Error) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  const removePlan = async (p: Plan) => {
    if (!confirm(`Xoá kế hoạch "${p.title}"? Công việc đã gắn vẫn giữ nguyên.`)) return;
    try {
      await clientApi(`/media/plans/${p.id}`, { method: "DELETE" });
      toast.success("Đã xoá kế hoạch");
      load();
      onOptionsChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const shown = (plans ?? []).filter((p) => !period || p.period_type === period);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div>
        <SectionTitle
          title="Kế hoạch nội dung"
          action={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                {(["", "day", "week", "month"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setPeriod(k)} className={cn("rounded-md px-2.5 py-1", period === k ? "bg-white text-violet-700 shadow-sm" : "text-slate-500")}>
                    {k ? PERIOD[k].label : "Tất cả"}
                  </button>
                ))}
              </div>
              {manage && (
                <Button size="sm" onClick={() => setEditPlan("new")} className="bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90">
                  <Plus className="mr-1 inline size-4" />Kế hoạch
                </Button>
              )}
            </div>
          }
        />
        {!plans ? (
          <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="size-6 animate-spin" /></div>
        ) : shown.length === 0 ? (
          <StudioCard className="py-12 text-center text-sm text-slate-400">Chưa có kế hoạch nào.</StudioCard>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {shown.map((p) => (
              <StudioCard key={p.id} className="group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip className={PERIOD[p.period_type].chip}>{PERIOD[p.period_type].label}</Chip>
                      <span className="text-xs text-slate-500">{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</span>
                    </div>
                    <p className="mt-1 font-bold text-slate-800">{p.title}</p>
                    <p className="truncate text-xs text-slate-500">{[p.campaign?.name, p.company_name, p.factory].filter(Boolean).join(" · ") || "Chưa gắn chiến dịch/nhà máy"}</p>
                  </div>
                  {manage && (
                    <div className="flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <button type="button" onClick={() => setEditPlan(p)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil className="size-4" /></button>
                      <button type="button" onClick={() => removePlan(p)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="size-4" /></button>
                    </div>
                  )}
                </div>
                {p.platforms.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{p.platforms.map((pl) => <PlatformChip key={pl} platform={pl} />)}</div>}
                <div className="mt-3 space-y-2">
                  {TARGETS.map((t) => {
                    const target = p.targets[t.key];
                    const done = p.done[t.key];
                    const planned = p.planned[t.key];
                    if (!target && !planned) return null;
                    const pct = target ? Math.min(100, (done / target) * 100) : 0;
                    return (
                      <div key={t.key}>
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-600">{t.emoji} {t.label}</span>
                          <span className="text-slate-500 tabular-nums"><b className="text-slate-800">{done}</b>/{target} xong · {planned} đã giao</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-500", t.bar)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {p.note && <p className="mt-2 text-xs whitespace-pre-wrap text-slate-500">{p.note}</p>}
              </StudioCard>
            ))}
          </div>
        )}
      </div>

      {/* Chiến dịch */}
      <div>
        <SectionTitle
          title="Chiến dịch tuyển dụng"
          action={manage && <Button size="sm" variant="outline" onClick={() => setEditCampaign("new")}><Plus className="mr-1 inline size-4" />Chiến dịch</Button>}
        />
        <div className="space-y-2">
          {campaigns.length === 0 && <StudioCard className="py-8 text-center text-sm text-slate-400">Chưa có chiến dịch.</StudioCard>}
          {campaigns.map((c) => (
            <StudioCard key={c.id} className={cn("flex items-start gap-3 p-3", !c.active && "opacity-60")}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 text-white"><Flag className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{c.name}{!c.active && <span className="ml-1 text-xs font-normal text-slate-400">(đã kết thúc)</span>}</p>
                <p className="truncate text-xs text-slate-500">{[c.company_name, c.factory].filter(Boolean).join(" · ") || "—"}</p>
                <p className="text-[11px] text-slate-400">{c.start_date ? fmtDate(c.start_date) : "?"} → {c.end_date ? fmtDate(c.end_date) : "?"} · {c.task_count} việc · {c.publication_count} bài đăng</p>
              </div>
              {manage && <button type="button" onClick={() => setEditCampaign(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil className="size-4" /></button>}
            </StudioCard>
          ))}
        </div>
      </div>

      {editPlan && (
        <PlanForm
          options={options}
          plan={editPlan === "new" ? null : editPlan}
          onClose={() => setEditPlan(null)}
          onSaved={() => {
            setEditPlan(null);
            load();
            onOptionsChanged();
          }}
        />
      )}
      {editCampaign && (
        <CampaignForm
          options={options}
          campaign={editCampaign === "new" ? null : editCampaign}
          onClose={() => setEditCampaign(null)}
          onSaved={() => {
            setEditCampaign(null);
            load();
            onOptionsChanged();
          }}
        />
      )}
    </div>
  );
}

function defaultRange(period: Plan["period_type"]): [string, string] {
  const now = new Date();
  if (period === "day") return [ymd(now), ymd(now)];
  if (period === "week") {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return [ymd(monday), ymd(sunday)];
  }
  return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
}

function PlanForm({ options, plan, onClose, onSaved }: { options: MediaOptions; plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [d0, d1] = defaultRange(plan?.period_type ?? "week");
  const [form, setForm] = useState({
    title: plan?.title ?? "",
    period_type: plan?.period_type ?? ("week" as Plan["period_type"]),
    start_date: dateOnly(plan?.start_date ?? null) || d0,
    end_date: dateOnly(plan?.end_date ?? null) || d1,
    company_id: plan?.company_id ?? "",
    factory: plan?.factory ?? "",
    campaign_id: plan?.campaign?.id ?? "",
    platforms: plan?.platforms ?? ([] as string[]),
    target_videos: plan?.targets.video ?? 0,
    target_posts: plan?.targets.post ?? 0,
    target_livestreams: plan?.targets.livestream ?? 0,
    note: plan?.note ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Nhập tên kế hoạch");
    setSaving(true);
    try {
      await clientApi(plan ? `/media/plans/${plan.id}` : "/media/plans", {
        method: plan ? "PUT" : "POST",
        body: JSON.stringify({ ...form, company_id: form.company_id || null, campaign_id: form.campaign_id || null, factory: form.factory || null, note: form.note || null }),
      });
      toast.success("Đã lưu kế hoạch");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={plan ? "Sửa kế hoạch" : "Kế hoạch nội dung mới"}
      maxWidth="max-w-xl"
      footer={<><Button variant="outline" onClick={onClose}>Huỷ</Button><Button disabled={saving} onClick={save}>{saving ? "Đang lưu..." : "Lưu"}</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên kế hoạch *" className="sm:col-span-2"><Input value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Theo">
          <Select
            value={form.period_type}
            onChange={(e) => {
              const p = e.target.value as Plan["period_type"];
              const [a, b] = defaultRange(p);
              setForm((f) => ({ ...f, period_type: p, start_date: a, end_date: b }));
            }}
          >
            {Object.entries(PERIOD).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
        <Field label="Chiến dịch">
          <Select value={form.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}>
            <option value="">—</option>
            {options.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Từ ngày"><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="Đến ngày"><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        <Field label="Công ty">
          <Select value={form.company_id} onChange={(e) => set("company_id", e.target.value)}>
            <option value="">—</option>
            {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Nhà máy"><Input value={form.factory} maxLength={200} onChange={(e) => set("factory", e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-slate-700">Nền tảng</p>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <label key={p} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <Checkbox checked={form.platforms.includes(p)} onChange={(e) => set("platforms", e.target.checked ? [...form.platforms, p] : form.platforms.filter((x) => x !== p))} />
                {PLATFORM_META[p].label}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <Field label="🎬 Số video"><Input type="number" min={0} value={form.target_videos} onChange={(e) => set("target_videos", Number(e.target.value) || 0)} /></Field>
          <Field label="📝 Số bài viết"><Input type="number" min={0} value={form.target_posts} onChange={(e) => set("target_posts", Number(e.target.value) || 0)} /></Field>
          <Field label="🔴 Livestream"><Input type="number" min={0} value={form.target_livestreams} onChange={(e) => set("target_livestreams", Number(e.target.value) || 0)} /></Field>
        </div>
        <Field label="Ghi chú" className="sm:col-span-2"><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function CampaignForm({ options, campaign, onClose, onSaved }: { options: MediaOptions; campaign: Campaign | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: campaign?.name ?? "",
    company_id: campaign?.company_id ?? "",
    factory: campaign?.factory ?? "",
    start_date: dateOnly(campaign?.start_date ?? null),
    end_date: dateOnly(campaign?.end_date ?? null),
    note: campaign?.note ?? "",
    active: campaign?.active ?? true,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const body = () => ({ ...form, company_id: form.company_id || null, factory: form.factory || null, start_date: form.start_date || null, end_date: form.end_date || null, note: form.note || null });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nhập tên chiến dịch");
    setSaving(true);
    try {
      await clientApi(campaign ? `/media/campaigns/${campaign.id}` : "/media/campaigns", { method: campaign ? "PUT" : "POST", body: JSON.stringify(body()) });
      toast.success("Đã lưu chiến dịch");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!campaign || !confirm(`Xoá chiến dịch "${campaign.name}"? Công việc/bài đăng đã gắn sẽ bỏ trống chiến dịch.`)) return;
    try {
      await clientApi(`/media/campaigns/${campaign.id}`, { method: "DELETE" });
      toast.success("Đã xoá chiến dịch");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal
      title={campaign ? "Sửa chiến dịch" : "Chiến dịch mới"}
      footer={
        <>
          {campaign && <Button variant="danger" onClick={remove}>Xoá</Button>}
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button disabled={saving} onClick={save}>{saving ? "Đang lưu..." : "Lưu"}</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Tên chiến dịch *"><Input value={form.name} maxLength={200} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Công ty">
          <Select value={form.company_id} onChange={(e) => set("company_id", e.target.value)}>
            <option value="">—</option>
            {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Nhà máy"><Input value={form.factory} maxLength={200} onChange={(e) => set("factory", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Bắt đầu"><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="Kết thúc"><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        </div>
        <Field label="Ghi chú"><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></Field>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600"><Checkbox checked={form.active} onChange={(e) => set("active", e.target.checked)} />Đang chạy</label>
      </div>
    </Modal>
  );
}

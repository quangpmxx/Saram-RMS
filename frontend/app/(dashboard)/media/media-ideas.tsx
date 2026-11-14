"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, Loader2, Pencil, Plus, Rocket, Search, Trash2 } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { Chip, IDEA_STATUS, PersonChip, StudioCard, TYPE_EMOJI, TYPE_LABEL, type MediaOptions, type Person } from "./media-shared";
import { TaskFormModal, type TaskPrefill } from "./media-task-form";

interface Idea {
  id: string;
  title: string;
  kind: string;
  status: string;
  topic: string | null;
  company_id: string | null;
  company_name: string | null;
  factory: string | null;
  campaign: { id: string; name: string } | null;
  hook: string | null;
  script: string | null;
  dialogue: string | null;
  content: string | null;
  cta: string | null;
  task_count: number;
  created_by: Person | null;
  created_at: string;
}

const KIND_GRAD: Record<string, string> = {
  video: "from-violet-500 to-fuchsia-500",
  post: "from-sky-400 to-blue-600",
  livestream: "from-orange-400 to-rose-500",
};

/** Kho ý tưởng + kịch bản: tìm kiếm, cảnh báo trùng, chuyển thành công việc. */
export function MediaIdeas({ options, canEdit }: { options: MediaOptions; canEdit: boolean }) {
  const toast = useToast();
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Idea | "new" | null>(null);
  const [viewing, setViewing] = useState<Idea | null>(null);
  const [toTask, setToTask] = useState<TaskPrefill | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (kind) p.set("kind", kind);
    if (status) p.set("status", status);
    clientApi<Idea[]>(`/media/ideas?${p.toString()}`).then(setIdeas).catch((e: Error) => toast.error(e.message));
  }, [q, kind, status, toast]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const canManage = (i: Idea) => canEdit && (options.me.can_assign || i.created_by?.id === options.me.id);

  const remove = async (i: Idea) => {
    if (!confirm(`Xoá ý tưởng "${i.title}"?`)) return;
    try {
      await clientApi(`/media/ideas/${i.id}`, { method: "DELETE" });
      toast.success("Đã xoá");
      setViewing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <StudioCard className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input uiSize="sm" className="pl-8" placeholder="Tìm ý tưởng, chủ đề, nhà máy, kịch bản..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select uiSize="sm" className="w-auto" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Mọi loại</option>
          {["video", "post", "livestream"].map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
        </Select>
        <Select uiSize="sm" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(IDEA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        {canEdit && (
          <Button size="sm" className="ml-auto bg-gradient-to-r from-amber-400 to-orange-500 shadow-orange-500/30 hover:opacity-90" onClick={() => setEditing("new")}>
            <Plus className="mr-1 inline size-4" />Thêm ý tưởng
          </Button>
        )}
      </StudioCard>

      {!ideas ? (
        <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="size-6 animate-spin" /></div>
      ) : ideas.length === 0 ? (
        <StudioCard className="py-12 text-center text-sm text-slate-400"><Lightbulb className="mx-auto mb-2 size-8 text-amber-400" />Chưa có ý tưởng nào.</StudioCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ideas.map((i) => (
            <button key={i.id} type="button" onClick={() => setViewing(i)} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/10">
              <div className={cn("flex items-center justify-between bg-gradient-to-r px-4 py-2 text-white", KIND_GRAD[i.kind] ?? KIND_GRAD.video)}>
                <span className="text-xs font-bold">{TYPE_EMOJI[i.kind]} {TYPE_LABEL[i.kind] ?? i.kind}</span>
                <Chip className={cn("bg-white/90", IDEA_STATUS[i.status]?.chip)}>{IDEA_STATUS[i.status]?.label ?? i.status}</Chip>
              </div>
              <div className="p-4">
                <p className="line-clamp-2 font-semibold text-slate-800 group-hover:text-orange-600">{i.title}</p>
                {i.hook && <p className="mt-1 line-clamp-2 text-xs text-slate-500 italic">“{i.hook}”</p>}
                <div className="mt-3 flex flex-wrap gap-1">
                  {i.topic && <Chip className="bg-amber-50 text-amber-700">#{i.topic}</Chip>}
                  {i.factory && <Chip className="bg-slate-100 text-slate-600">🏭 {i.factory}</Chip>}
                  {i.campaign && <Chip className="bg-violet-50 text-violet-700">{i.campaign.name}</Chip>}
                  {i.task_count > 0 && <Chip className="bg-emerald-50 text-emerald-700">{i.task_count} việc</Chip>}
                </div>
                <div className="mt-3"><PersonChip person={i.created_by} size="xs" /></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <Modal
          title={viewing.title}
          description={[TYPE_LABEL[viewing.kind], viewing.topic, viewing.company_name, viewing.factory, viewing.campaign?.name].filter(Boolean).join(" · ")}
          maxWidth="max-w-2xl"
          footer={
            <>
              {canManage(viewing) && (
                <>
                  <Button variant="danger" onClick={() => remove(viewing)}><Trash2 className="mr-1 inline size-4" />Xoá</Button>
                  <Button variant="outline" onClick={() => { setEditing(viewing); setViewing(null); }}><Pencil className="mr-1 inline size-4" />Sửa</Button>
                </>
              )}
              {canEdit && options.me.can_assign && (
                <Button
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:opacity-90"
                  onClick={() => {
                    setToTask({
                      title: viewing.title,
                      description: [viewing.hook && `Hook: ${viewing.hook}`, viewing.cta && `CTA: ${viewing.cta}`].filter(Boolean).join("\n"),
                      type: viewing.kind,
                      idea_id: viewing.id,
                      campaign_id: viewing.campaign?.id,
                      company_id: viewing.company_id ?? undefined,
                      factory: viewing.factory ?? undefined,
                    });
                    setViewing(null);
                  }}
                >
                  <Rocket className="mr-1 inline size-4" />Tạo công việc
                </Button>
              )}
              <Button variant="outline" onClick={() => setViewing(null)}>Đóng</Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            {(
              [
                ["Hook mở đầu", viewing.hook],
                ["Kịch bản", viewing.script],
                ["Lời thoại", viewing.dialogue],
                ["Nội dung", viewing.content],
                ["CTA", viewing.cta],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label}>
                  <p className="text-[11px] font-bold tracking-wide text-orange-500 uppercase">{label}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{value}</p>
                </div>
              ) : null,
            )}
          </div>
        </Modal>
      )}

      {editing && (
        <IdeaFormModal
          options={options}
          idea={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {toTask && (
        <TaskFormModal
          options={options}
          prefill={toTask}
          onClose={() => setToTask(null)}
          onSaved={() => {
            setToTask(null);
            toast.success("Ý tưởng đã chuyển thành công việc");
            load();
          }}
        />
      )}
    </div>
  );
}

function IdeaFormModal({ options, idea, onClose, onSaved }: { options: MediaOptions; idea: Idea | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [similar, setSimilar] = useState<{ id: string; title: string; status: string; score: number }[]>([]);
  const [form, setForm] = useState({
    title: idea?.title ?? "",
    kind: idea?.kind ?? "video",
    status: idea?.status ?? "new",
    topic: idea?.topic ?? "",
    company_id: idea?.company_id ?? "",
    factory: idea?.factory ?? "",
    campaign_id: idea?.campaign?.id ?? "",
    hook: idea?.hook ?? "",
    script: idea?.script ?? "",
    dialogue: idea?.dialogue ?? "",
    content: idea?.content ?? "",
    cta: idea?.cta ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Cảnh báo trùng khi gõ tiêu đề.
  useEffect(() => {
    const title = form.title.trim();
    const t = setTimeout(() => {
      if (title.length < 3) {
        setSimilar([]);
        return;
      }
      const p = new URLSearchParams({ title });
      if (idea) p.set("exclude", idea.id);
      clientApi<typeof similar>(`/media/ideas/similar?${p.toString()}`).then(setSimilar).catch(() => setSimilar([]));
    }, 400);
    return () => clearTimeout(t);
  }, [form.title, idea]);

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Nhập tên ý tưởng");
      return;
    }
    setSaving(true);
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === "" ? null : v]));
    try {
      await clientApi(idea ? `/media/ideas/${idea.id}` : "/media/ideas", { method: idea ? "PUT" : "POST", body: JSON.stringify(body) });
      toast.success(idea ? "Đã lưu ý tưởng" : "Đã thêm vào kho ý tưởng 💡");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={idea ? "Sửa ý tưởng" : "Ý tưởng mới 💡"}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button disabled={saving} onClick={save} className="bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90">{saving ? "Đang lưu..." : "Lưu"}</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên ý tưởng *" className="sm:col-span-2">
          <Input value={form.title} maxLength={255} onChange={(e) => set("title", e.target.value)} />
        </Field>
        {similar.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:col-span-2">
            <p className="flex items-center gap-1.5 font-bold"><AlertTriangle className="size-4" /> Có thể trùng ý tưởng đã có:</p>
            <ul className="mt-1 list-disc pl-5">
              {similar.map((s) => <li key={s.id}>{s.title} <span className="text-amber-600">({IDEA_STATUS[s.status]?.label ?? s.status}, giống {Math.round(s.score * 100)}%)</span></li>)}
            </ul>
          </div>
        )}
        <Field label="Loại">
          <Select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            {["video", "post", "livestream"].map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
          </Select>
        </Field>
        <Field label="Trạng thái">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {Object.entries(IDEA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
        <Field label="Chủ đề"><Input value={form.topic} maxLength={200} onChange={(e) => set("topic", e.target.value)} placeholder="VD: Đời sống công nhân" /></Field>
        <Field label="Chiến dịch">
          <Select value={form.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}>
            <option value="">—</option>
            {options.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Công ty">
          <Select value={form.company_id} onChange={(e) => set("company_id", e.target.value)}>
            <option value="">—</option>
            {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Nhà máy"><Input value={form.factory} maxLength={200} onChange={(e) => set("factory", e.target.value)} /></Field>
        <Field label="Hook mở đầu" className="sm:col-span-2"><Textarea rows={2} value={form.hook} onChange={(e) => set("hook", e.target.value)} /></Field>
        <Field label="Kịch bản" className="sm:col-span-2"><Textarea rows={4} value={form.script} onChange={(e) => set("script", e.target.value)} /></Field>
        <Field label="Lời thoại" className="sm:col-span-2"><Textarea rows={3} value={form.dialogue} onChange={(e) => set("dialogue", e.target.value)} /></Field>
        <Field label="Nội dung / caption" className="sm:col-span-2"><Textarea rows={3} value={form.content} onChange={(e) => set("content", e.target.value)} /></Field>
        <Field label="CTA (kêu gọi hành động)" className="sm:col-span-2"><Input value={form.cta} onChange={(e) => set("cta", e.target.value)} placeholder="VD: Inbox ngay để được tư vấn việc làm" /></Field>
      </div>
    </Modal>
  );
}

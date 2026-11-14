"use client";

import { useState } from "react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { PLATFORMS, PLATFORM_META, PRIORITY_META, TYPE_LABEL, toLocalInput, type MediaOptions, type MediaTask, type Priority } from "./media-shared";

export interface TaskPrefill {
  title?: string;
  description?: string;
  type?: string;
  idea_id?: string;
  campaign_id?: string;
  company_id?: string;
  factory?: string;
  plan_id?: string;
}

/** Thêm / sửa công việc Media (chỉ người có quyền giao việc). */
export function TaskFormModal({
  options,
  task,
  prefill,
  onClose,
  onSaved,
}: {
  options: MediaOptions;
  task?: MediaTask | null;
  prefill?: TaskPrefill;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: task?.title ?? prefill?.title ?? "",
    description: task?.description ?? prefill?.description ?? "",
    type: task?.type ?? prefill?.type ?? "video",
    priority: (task?.priority ?? "normal") as Priority,
    deadline: toLocalInput(task?.deadline ?? null),
    platform: task?.platform ?? "",
    plan_id: task?.plan?.id ?? prefill?.plan_id ?? "",
    campaign_id: task?.campaign?.id ?? prefill?.campaign_id ?? "",
    company_id: task?.company_id ?? prefill?.company_id ?? "",
    factory: task?.factory ?? prefill?.factory ?? "",
    idea_id: task?.idea?.id ?? prefill?.idea_id ?? "",
    assignee_id: task?.assignee?.id ?? "",
    member_ids: task?.members.map((m) => m.id) ?? ([] as string[]),
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toggleMember = (id: string) =>
    set("member_ids", form.member_ids.includes(id) ? form.member_ids.filter((m) => m !== id) : [...form.member_ids, id]);

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Nhập tên nội dung");
      return;
    }
    setSaving(true);
    const body = {
      title: form.title.trim(),
      description: form.description || null,
      type: form.type,
      priority: form.priority,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      platform: form.platform || null,
      plan_id: form.plan_id || null,
      campaign_id: form.campaign_id || null,
      company_id: form.company_id || null,
      factory: form.factory || null,
      idea_id: form.idea_id || null,
      assignee_id: form.assignee_id || null,
      member_ids: form.member_ids.filter((m) => m !== form.assignee_id),
    };
    try {
      if (task) {
        await clientApi(`/media/tasks/${task.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast.success("Đã cập nhật công việc");
        onSaved(task.id);
      } else {
        const res = await clientApi<{ id: string; code: string }>("/media/tasks", { method: "POST", body: JSON.stringify(body) });
        toast.success(`Đã tạo ${res.code}`);
        onSaved(res.id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={task ? `Sửa ${task.code}` : "Giao việc mới ✨"}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-fuchsia-500/30 hover:opacity-90">
            {saving ? "Đang lưu..." : task ? "Lưu" : "Tạo & giao việc"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên nội dung *" className="sm:col-span-2">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={255} placeholder="VD: Video review ký túc xá nhà máy A" />
        </Field>
        <Field label="Mô tả / yêu cầu" className="sm:col-span-2">
          <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Loại công việc">
          <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Mức độ ưu tiên">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
            {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
        <Field label="Deadline">
          <Input type="datetime-local" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </Field>
        <Field label="Nền tảng">
          <Select value={form.platform} onChange={(e) => set("platform", e.target.value)}>
            <option value="">—</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
          </Select>
        </Field>
        <Field label="Người phụ trách chính">
          <Select value={form.assignee_id} onChange={(e) => set("assignee_id", e.target.value)}>
            <option value="">— Chưa giao —</option>
            {options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Kế hoạch">
          <Select value={form.plan_id} onChange={(e) => set("plan_id", e.target.value)}>
            <option value="">—</option>
            {options.plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </Select>
        </Field>
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
        <Field label="Nhà máy">
          <Input value={form.factory} onChange={(e) => set("factory", e.target.value)} maxLength={200} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-slate-700">Người cùng tham gia</p>
          <div className="flex flex-wrap gap-1.5">
            {options.staff
              .filter((s) => s.id !== form.assignee_id)
              .map((s) => {
                const on = form.member_ids.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleMember(s.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs font-medium transition-all",
                      on ? "border-violet-400 bg-violet-50 text-violet-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200",
                    )}
                  >
                    <Avatar fullName={s.name} avatarUrl={s.avatar_url} className="h-5! w-5! text-[9px]!" />
                    {s.name}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

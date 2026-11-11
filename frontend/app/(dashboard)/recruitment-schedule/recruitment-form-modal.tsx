"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { RecruitmentKind, RecruitmentPosting, RecruitmentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";
import { STATUS_META, buildZaloMessage, formatMillions } from "./recruitment-shared";

const digits = (value: string) => value.replace(/\D/g, "");
const toInt = (value: string): number | null => (digits(value) === "" ? null : Number(digits(value)));

/** Các mục chữ tự do — mỗi dòng 1 ý. */
const TEXT_SECTIONS: { key: "work" | "documents" | "bonus" | "salary_note" | "housing" | "notes" | "pros" | "cons"; label: string; hint?: string }[] = [
  { key: "work", label: "Công việc" },
  { key: "documents", label: "Hồ sơ, đi phỏng vấn mang gì" },
  { key: "salary_note", label: "Chi tiết lương" },
  { key: "bonus", label: "Các mốc thưởng", hint: "Mỗi dòng một mốc, vd: T1: 2.000.000 (CTY)" },
  { key: "housing", label: "Trọ gần, đi lại" },
  { key: "notes", label: "Lưu ý" },
  { key: "pros", label: "Ưu điểm" },
  { key: "cons", label: "Nhược điểm" },
];

/**
 * Lịch tuyển dụng: popup thêm/sửa 1 thẻ tuyển dụng. `posting = null` là thêm mới
 * (vào đúng tab đang mở). Xoá cũng nằm ở đây để tránh bấm nhầm ngoài danh sách.
 */
export function RecruitmentFormModal({
  posting,
  defaultKind,
  teamOptions,
  defaultTeamId,
  areaOptions,
  tagOptions,
  onClose,
  onSaved,
  onDeleted,
}: {
  posting: RecruitmentPosting | null;
  defaultKind: RecruitmentKind;
  /** Danh sách nhóm để chọn — chỉ người thấy mọi nhóm; null = thẻ luôn thuộc nhóm của người dùng. */
  teamOptions: { id: string; name: string }[] | null;
  /** Nhóm đang xem khi bấm "Thêm công ty". */
  defaultTeamId: string | null;
  areaOptions: string[];
  /** Nhãn có sẵn + nhãn tự thêm đang dùng (collectTags). */
  tagOptions: { code: string; label: string }[];
  onClose: () => void;
  onSaved: (saved: RecruitmentPosting) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    company_name: posting?.company_name ?? "",
    kind: posting?.kind ?? defaultKind,
    team_id: (posting ? posting.team_id : defaultTeamId) ?? "",
    status: posting?.status ?? ("open" as RecruitmentStatus),
    area: posting?.area ?? "",
    accept_male: posting?.accept_male ?? true,
    accept_female: posting?.accept_female ?? true,
    age_min: posting?.age_min?.toString() ?? "",
    age_max: posting?.age_max?.toString() ?? "",
    requirement: posting?.requirement ?? "",
    base_salary: posting?.base_salary?.toString() ?? "",
    allowance: posting?.allowance?.toString() ?? "",
    bonus_summary: posting?.bonus_summary ?? "",
    interview_slot: posting?.interview_slot ?? "",
    tags: posting?.tags ?? ([] as string[]),
    work: posting?.work ?? "",
    documents: posting?.documents ?? "",
    salary_note: posting?.salary_note ?? "",
    bonus: posting?.bonus ?? "",
    housing: posting?.housing ?? "",
    notes: posting?.notes ?? "",
    pros: posting?.pros ?? "",
    cons: posting?.cons ?? "",
    zalo_message: posting?.zalo_message ?? "",
  });
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /** Nhãn mới gõ tay: trùng tên nhãn có sẵn thì bật nhãn đó, không tạo nhãn trùng. */
  function addCustomTag() {
    const text = newTag.trim();
    setNewTag("");
    if (!text) return;
    const known = tagOptions.find((o) => o.label.toLowerCase() === text.toLowerCase() || o.code === text);
    const code = known?.code ?? form.tags.find((t) => t.toLowerCase() === text.toLowerCase()) ?? text;
    if (!form.tags.includes(code)) set("tags", [...form.tags, code]);
  }

  /** Đổ tin phần mềm tự soạn (theo các ô đang nhập) vào ô tin Zalo để sửa tiếp. */
  function fillAutoMessage() {
    const draft = {
      ...form,
      age_min: toInt(form.age_min),
      age_max: toInt(form.age_max),
      base_salary: toInt(form.base_salary),
      allowance: toInt(form.allowance),
      area: form.area.trim() || null,
    } as unknown as RecruitmentPosting;
    set("zalo_message", buildZaloMessage(draft, new Date().getFullYear()));
  }

  function toggleTag(code: string) {
    set("tags", form.tags.includes(code) ? form.tags.filter((t) => t !== code) : [...form.tags, code]);
  }

  async function handleSave() {
    if (isSaving) return;
    if (!form.company_name.trim()) {
      toast.error("Chưa nhập tên công ty");
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        ...form,
        company_name: form.company_name.trim(),
        // Chỉ người thấy mọi nhóm mới gửi nhóm; vai trò khác backend tự gán nhóm của họ.
        team_id: teamOptions ? form.team_id || null : undefined,
        age_min: toInt(form.age_min),
        age_max: toInt(form.age_max),
        base_salary: toInt(form.base_salary),
        allowance: toInt(form.allowance),
      };
      const saved = await clientApi<RecruitmentPosting>(
        posting ? `/recruitment-schedule/${posting.id}` : "/recruitment-schedule",
        { method: posting ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      toast.success(posting ? "Đã lưu thay đổi" : "Đã thêm công ty vào Lịch tuyển");
      onSaved(saved);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, không thể lưu");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!posting || isDeleting) return;
    if (!window.confirm(`Xoá "${posting.company_name}" khỏi Lịch tuyển? Hành động này không thể hoàn tác.`)) return;
    setIsDeleting(true);
    try {
      await clientApi(`/recruitment-schedule/${posting.id}`, { method: "DELETE" });
      toast.success("Đã xoá khỏi Lịch tuyển");
      onDeleted(posting.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, không thể xoá");
    } finally {
      setIsDeleting(false);
    }
  }

  const baseNumber = toInt(form.base_salary);
  const allowanceNumber = toInt(form.allowance);

  return (
    <Modal
      title={posting ? `Sửa: ${posting.company_name}` : "Thêm công ty vào Lịch tuyển"}
      maxWidth="max-w-3xl"
      footer={
        <>
          {posting && (
            <Button type="button" variant="danger" size="sm" className="mr-auto" disabled={isDeleting} onClick={() => void handleDelete()}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              {isDeleting ? "Đang xoá..." : "Xoá khỏi Lịch tuyển"}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" size="sm" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên công ty" uiSize="sm" className="sm:col-span-2">
            <Input uiSize="sm" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} autoFocus={!posting} />
          </Field>
          {teamOptions && (
            <Field label="Lịch tuyển của nhóm" uiSize="sm" className="sm:col-span-2">
              <Select uiSize="sm" value={form.team_id} onChange={(e) => set("team_id", e.target.value)}>
                <option value="">— Chưa gán nhóm —</option>
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Loại tuyển" uiSize="sm">
            <Select uiSize="sm" value={form.kind} onChange={(e) => set("kind", e.target.value as RecruitmentKind)}>
              <option value="official">Chính thức</option>
              <option value="seasonal">Thời vụ</option>
            </Select>
          </Field>
          <Field label="Trạng thái tuyển" uiSize="sm">
            <Select uiSize="sm" value={form.status} onChange={(e) => set("status", e.target.value as RecruitmentStatus)}>
              {(Object.keys(STATUS_META) as RecruitmentStatus[]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Khu vực" uiSize="sm">
            <Input uiSize="sm" list="recruitment-area-options" value={form.area} onChange={(e) => set("area", e.target.value)} />
            <datalist id="recruitment-area-options">
              {areaOptions.map((area) => (
                <option key={area} value={area} />
              ))}
            </datalist>
          </Field>
          <Field label="Lịch phỏng vấn" uiSize="sm">
            <Input uiSize="sm" placeholder="vd: Sáng 8h, Chiều 14h" value={form.interview_slot} onChange={(e) => set("interview_slot", e.target.value)} />
          </Field>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Nhận ai</p>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={form.accept_male} onChange={(e) => set("accept_male", e.target.checked)} />
              Nhận Nam
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={form.accept_female} onChange={(e) => set("accept_female", e.target.checked)} />
              Nhận Nữ
            </label>
            <Field label="Tuổi từ" uiSize="sm" className="w-20">
              <Input uiSize="sm" inputMode="numeric" value={form.age_min} onChange={(e) => set("age_min", digits(e.target.value).slice(0, 2))} />
            </Field>
            <Field label="Tuổi đến" uiSize="sm" className="w-20">
              <Input uiSize="sm" inputMode="numeric" value={form.age_max} onChange={(e) => set("age_max", digits(e.target.value).slice(0, 2))} />
            </Field>
          </div>
          <Field label="Yêu cầu khác" uiSize="sm" className="mt-3">
            <Textarea rows={2} placeholder="vd: có bằng cấp 3, nhận cặp nam nữ…" value={form.requirement} onChange={(e) => set("requirement", e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lương cơ bản (đồng)" uiSize="sm" hint={baseNumber ? formatMillions(baseNumber) : undefined}>
            <Input uiSize="sm" inputMode="numeric" placeholder="5700000" value={form.base_salary} onChange={(e) => set("base_salary", digits(e.target.value))} />
          </Field>
          <Field label="Phụ cấp (đồng)" uiSize="sm" hint={allowanceNumber ? formatMillions(allowanceNumber) : undefined}>
            <Input uiSize="sm" inputMode="numeric" placeholder="1250000" value={form.allowance} onChange={(e) => set("allowance", digits(e.target.value))} />
          </Field>
          <Field label="Tổng thưởng" uiSize="sm">
            <Input uiSize="sm" placeholder="vd: 14 triệu / 4 tháng" value={form.bonus_summary} onChange={(e) => set("bonus_summary", e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Nhãn nhanh</p>
          <div className="flex flex-wrap gap-1.5">
            {[...tagOptions, ...form.tags.filter((t) => !tagOptions.some((o) => o.code === t)).map((t) => ({ code: t, label: t }))].map((tag) => {
              const active = form.tags.includes(tag.code);
              return (
                <button
                  key={tag.code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag.code)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {tag.label}
                </button>
              );
            })}
            <div className="w-44">
              <Input
                uiSize="xs"
                placeholder="Thêm nhãn khác rồi Enter…"
                maxLength={40}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addCustomTag();
                }}
                onBlur={addCustomTag}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {TEXT_SECTIONS.map((section) => (
            <Field key={section.key} label={section.label} hint={section.hint} uiSize="sm">
              <Textarea rows={4} value={form[section.key]} onChange={(e) => set(section.key, e.target.value)} />
            </Field>
          ))}
        </div>

        {/* Yêu cầu người dùng: tin Zalo phần mềm tự soạn nhưng cho sửa lại cho hợp ý. Trống = tự soạn. */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700">Tin gửi Zalo</p>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="xs" onClick={fillAutoMessage}>
                Điền tin phần mềm tự soạn
              </Button>
              {form.zalo_message !== "" && (
                <Button type="button" variant="ghost" size="xs" onClick={() => set("zalo_message", "")}>
                  Xoá, dùng tin tự soạn
                </Button>
              )}
            </div>
          </div>
          <Textarea
            rows={8}
            placeholder="Để trống = phần mềm tự soạn"
            value={form.zalo_message}
            onChange={(e) => set("zalo_message", e.target.value)}
          />
          {form.zalo_message.trim() !== "" && (
            <p className="mt-1 text-xs text-slate-400">Đổi lương, thưởng, lịch ở trên thì nhớ sửa lại tin này.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

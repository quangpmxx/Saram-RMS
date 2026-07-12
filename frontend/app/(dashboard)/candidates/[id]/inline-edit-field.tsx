"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/form";

/**
 * UI Polish — sửa nhanh trực tiếp 1 trường ngay trên trang Chi tiết ứng
 * viên (không chuyển trang), dùng chung cho Số điện thoại/Năm sinh/Địa chỉ.
 * Gọi PUT /candidate/:id/quick-edit (API mới, mở cho tất cả vai trò) — xem
 * candidates.service.ts (backend) để biết lý do không dùng PUT /candidate/:id.
 *
 * Dự án phụ — nâng cấp toàn diện: `alwaysEditable` cho Năm sinh/Địa chỉ —
 * hiện sẵn 1 ô nhập text (không cần bấm bút chì), gõ xong bấm Enter là lưu.
 * Số điện thoại KHÔNG đổi (vẫn kiểu bấm bút chì mới hiện ô sửa như cũ).
 */
export function InlineEditField({
  label,
  displayValue,
  editValue,
  inputType = "text",
  alwaysEditable = false,
  onSave,
}: {
  label: string;
  displayValue: string;
  editValue: string;
  inputType?: "text" | "number";
  alwaysEditable?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(alwaysEditable);
  const [draft, setDraft] = useState(editValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(editValue);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      await onSave(draft);
      if (!alwaysEditable) setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 py-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">{label}</span>
          <div className="flex items-center gap-1">
            <Input
              uiSize="sm"
              type={inputType}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSave();
                if (event.key === "Escape" && !alwaysEditable) setIsEditing(false);
              }}
              className="w-32"
              autoFocus={!alwaysEditable}
              disabled={isSaving}
            />
            {!alwaysEditable && (
              <>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                  className="rounded-md p-1 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                  title="Lưu"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  title="Hủy"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </>
            )}
          </div>
        </div>
        {error && <p className="text-right text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="group flex items-center gap-1 text-right text-slate-800">
        <span className="break-words">{displayValue}</span>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500 focus-visible:opacity-100"
          title={`Sửa ${label.toLowerCase()}`}
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
        </button>
      </dd>
    </div>
  );
}

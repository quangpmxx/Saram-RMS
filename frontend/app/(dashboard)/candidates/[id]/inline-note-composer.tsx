"use client";

import { useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

/**
 * Nhập ghi chú trực tiếp ngay trong khu vực lịch sử — không mở popup.
 * Enter để lưu, Shift+Enter xuống dòng. Lưu lỗi thì giữ nguyên nội dung đã
 * gõ; lưu thành công thì tự xóa nội dung và giữ con trỏ để nhập tiếp.
 */
export function InlineNoteComposer({
  onSubmit,
}: {
  onSubmit: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setIsSaving(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="border-b border-slate-100 p-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          disabled={isSaving}
          rows={2}
          placeholder="Nhập nội dung chăm sóc, nhấn Enter để lưu…"
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-400"
        />
        <button
          type="button"
          disabled={isSaving || !content.trim()}
          onClick={() => void handleSubmit()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          title="Lưu ghi chú"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import type { Note } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { NoteTimeline } from "./note-timeline";

function formatNoteTimestamp(value: string): string {
  const parsed = new Date(value);
  const time = parsed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = parsed.toLocaleDateString("vi-VN");
  return `${time} ${date}`;
}

/**
 * UI Polish (bổ sung) — trước đây chỉ hiện ghi chú chăm sóc gần nhất; nay
 * hiện TOÀN BỘ lịch sử chăm sóc (LeadNote chưa xóa) ngay trong cột "Tình
 * trạng cuộc gọi" của danh sách, dạng timeline mới→cũ, thu gọn còn 4 bản ghi
 * gần nhất kèm "Xem thêm" khi dài. `notes === undefined`: đang tải.
 */
export function CareNoteCell({ notes }: { notes: Note[] | undefined }) {
  if (notes === undefined) {
    return <p className="mt-2 text-xs text-slate-300">Đang tải ghi chú...</p>;
  }

  if (notes.length === 0) {
    return <p className="mt-2 text-xs text-slate-400">Chưa có ghi chú chăm sóc</p>;
  }

  return (
    <div className="mt-2">
      <NoteTimeline
        notes={notes}
        renderNote={(note) => (
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <span className="font-semibold text-slate-700">{note.created_by.name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{formatNoteTimestamp(note.created_at)}</span>
              {note.call_status && <Badge variant="info">{note.call_status.name}</Badge>}
            </div>
            <p className="mt-1 text-xs whitespace-pre-line text-slate-700">{note.content}</p>
          </div>
        )}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Note } from "@/lib/types";

const LENGTH_THRESHOLD = 160;
const LINE_THRESHOLD = 4;

function formatNoteTimestamp(value: string): string {
  const parsed = new Date(value);
  const time = parsed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = parsed.toLocaleDateString("vi-VN");
  return `Cập nhật lúc ${time} - ${date}`;
}

/**
 * UI Polish — nội dung ghi chú chăm sóc gần nhất (LeadNote mới nhất, chưa
 * xóa) hiển thị ngay dưới badge tình trạng/kết quả cuộc gọi trên danh sách.
 * `note === undefined`: đang tải; `null`: đã tải xong nhưng chưa có ghi chú.
 */
export function CareNoteCell({ note }: { note: Note | null | undefined }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (note === undefined) {
    return <p className="mt-2 text-xs text-slate-300">Đang tải ghi chú...</p>;
  }

  if (note === null) {
    return <p className="mt-2 text-xs text-slate-400">Chưa có ghi chú chăm sóc</p>;
  }

  const lineCount = note.content.split("\n").length;
  const isLong = note.content.length > LENGTH_THRESHOLD || lineCount > LINE_THRESHOLD;

  return (
    <div className="mt-2">
      <p
        className={`text-xs whitespace-pre-line text-slate-700 ${!isExpanded && isLong ? "line-clamp-4" : ""}`}
      >
        {note.content}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-0.5 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
      <p className="mt-1 text-[11px] text-slate-400">{formatNoteTimestamp(note.created_at)}</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Note } from "@/lib/types";
import { NameWithRoleHint } from "@/components/name-with-role-hint";
import { NoteTimeline } from "./note-timeline";

/** Bảng "Data lao động" — chiều cao hàng cố định, ô ghi chú chỉ hiện bản tóm tắt (Mục 6, yêu cầu tối ưu bảng); lịch sử đầy đủ xem tại trang Chi tiết ứng viên. */
const PREVIEW_COUNT = 2;
/** Chiều cao tối đa vùng danh sách note khi thu gọn — giảm ~40% so với bản trước (130px) theo yêu cầu tinh chỉnh bổ sung. */
const COLLAPSED_MAX_HEIGHT = 78;
/** Note dài hơn ngưỡng này (ký tự hoặc số dòng) mới cần cắt còn 3 dòng + nút "Xem thêm" riêng. */
const CONTENT_LENGTH_THRESHOLD = 120;
const CONTENT_LINE_THRESHOLD = 3;

function formatNoteTimestamp(value: string): string {
  const parsed = new Date(value);
  const time = parsed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = parsed.toLocaleDateString("vi-VN");
  return `${time} ${date}`;
}

/** Badge cỡ nhỏ riêng cho ô này (nhỏ hơn ~10-15% so với Badge dùng chung) — tránh xung đột class vì `cn()` trong dự án chỉ nối chuỗi, không dedupe Tailwind. */
function MiniStatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-medium whitespace-nowrap text-brand-700 ring-1 ring-inset ring-brand-600/20">
      {label}
    </span>
  );
}

function NoteContent({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lineCount = content.split("\n").length;
  const isLong = content.length > CONTENT_LENGTH_THRESHOLD || lineCount > CONTENT_LINE_THRESHOLD;

  return (
    <>
      <p
        className={`mt-0.5 text-[11px] leading-snug whitespace-pre-line text-slate-700 ${
          !isExpanded && isLong ? "line-clamp-3" : ""
        }`}
      >
        {content}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-0.5 text-[10px] font-medium text-brand-600 hover:text-brand-700"
        >
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </>
  );
}

/**
 * UI Polish (bổ sung) — TOÀN BỘ lịch sử chăm sóc (LeadNote chưa xóa) ngay
 * trong cột "Tình trạng cuộc gọi" của danh sách, dạng timeline mới→cũ,
 * nhưng chỉ là BẢN TÓM TẮT (tối đa 2 note gần nhất, mỗi note tối đa 3 dòng,
 * chiều cao vùng note cố định — đã giảm thêm ~40% theo yêu cầu tinh chỉnh
 * bổ sung) — mục tiêu ưu tiên xem được nhiều Data cùng lúc, không phải đọc
 * toàn bộ lịch sử (xem đầy đủ tại trang Chi tiết ứng viên). Dù có 100 ghi
 * chú, chiều cao ô/hàng vẫn cố định — chỉ mở rộng đúng ô khi bấm "Xem thêm".
 * `notes === undefined`: đang tải.
 */
export function CareNoteCell({ notes }: { notes: Note[] | undefined }) {
  const [isRowExpanded, setIsRowExpanded] = useState(false);

  if (notes === undefined) {
    return <p className="mt-2 text-xs text-slate-300">Đang tải ghi chú...</p>;
  }

  if (notes.length === 0) {
    return <p className="mt-2 text-xs text-slate-400">Chưa có ghi chú chăm sóc</p>;
  }

  return (
    <div className="mt-1">
      <NoteTimeline
        notes={notes}
        previewCount={PREVIEW_COUNT}
        compact
        collapsedMaxHeight={COLLAPSED_MAX_HEIGHT}
        expanded={isRowExpanded}
        onToggleExpanded={setIsRowExpanded}
        renderNote={(note) => (
          <div className="rounded-lg bg-slate-50 px-2 py-0.5">
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <NameWithRoleHint account={note.created_by} className="font-semibold text-slate-700" />
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{formatNoteTimestamp(note.created_at)}</span>
              {note.call_status && <MiniStatusBadge label={note.call_status.name} />}
            </div>
            <NoteContent content={note.content} />
          </div>
        )}
      />
    </div>
  );
}

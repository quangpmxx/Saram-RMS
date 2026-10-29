"use client";

import { formatDMY } from "@/lib/date-format";
import { callResultVariant, callStatusVariant } from "@/lib/call-status-variant";
import { useState } from "react";
import type { Note } from "@/lib/types";
import { NameWithRoleHint } from "@/components/name-with-role-hint";
import { NoteTimeline } from "./note-timeline";

/** Bảng "Data lao động" — chiều cao hàng cố định, ô ghi chú chỉ hiện bản tóm tắt (Mục 6, yêu cầu tối ưu bảng); lịch sử đầy đủ xem tại trang Chi tiết ứng viên. */
const PREVIEW_COUNT = 3;
/** Chiều cao tối đa vùng danh sách note khi thu gọn — giảm ~40% so với bản trước (130px) theo yêu cầu tinh chỉnh bổ sung. */
/** 2026-10-29: thu gọn khoảng cách để mặc định thấy 3 ghi chú (trước 2 ghi chú / 78px). */
const COLLAPSED_MAX_HEIGHT = 96;
/** Note dài hơn ngưỡng này (ký tự hoặc số dòng) mới cần cắt còn 3 dòng + nút "Xem thêm" riêng. */
const CONTENT_LENGTH_THRESHOLD = 120;
const CONTENT_LINE_THRESHOLD = 3;

function formatNoteTimestamp(value: string): string {
  const parsed = new Date(value);
  const time = parsed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = formatDMY(parsed);
  return `${time} ${date}`;
}

/** Badge cỡ nhỏ riêng cho ô này (nhỏ hơn ~10-15% so với Badge dùng chung) — tránh xung đột class vì `cn()` trong dự án chỉ nối chuỗi, không dedupe Tailwind. */
const MINI_BADGE_TONE: Record<"info" | "neutral" | "warning" | "danger" | "success", string> = {
  info: "bg-brand-50 text-brand-700 ring-brand-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

function MiniStatusBadge({ label, tone }: { label: string; tone: keyof typeof MINI_BADGE_TONE }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] leading-none font-medium whitespace-nowrap ring-1 ring-inset ${MINI_BADGE_TONE[tone]}`}
    >
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
        className={`text-[11px] leading-tight whitespace-pre-line text-slate-700 ${
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
    return <p className="text-xs text-slate-300">Đang tải ghi chú...</p>;
  }

  if (notes.length === 0) {
    return <p className="text-xs text-slate-400">Chưa có ghi chú chăm sóc</p>;
  }

  return (
    <div>
      <NoteTimeline
        notes={notes}
        previewCount={PREVIEW_COUNT}
        compact
        collapsedMaxHeight={COLLAPSED_MAX_HEIGHT}
        expanded={isRowExpanded}
        onToggleExpanded={setIsRowExpanded}
        renderNote={(note) => (
          <div className="rounded-md bg-slate-50 px-1.5 py-px">
            <div className="flex flex-wrap items-center gap-x-1 gap-y-px text-[10px] leading-tight">
              <NameWithRoleHint account={note.created_by} className="font-semibold text-slate-700" />
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{formatNoteTimestamp(note.created_at)}</span>
              {/* Nhãn của chính lần xử lý này (tình trạng + kết quả) — thay cho dòng
                  nhãn chung đầu ô đã bỏ (yêu cầu người dùng 2026-10-29). */}
              {note.call_status && (
                <MiniStatusBadge label={note.call_status.name} tone={callStatusVariant(note.call_status.name)} />
              )}
              {note.call_result && (
                <MiniStatusBadge label={note.call_result.name} tone={callResultVariant(note.call_result.name)} />
              )}
            </div>
            <NoteContent content={note.content} />
          </div>
        )}
      />
    </div>
  );
}

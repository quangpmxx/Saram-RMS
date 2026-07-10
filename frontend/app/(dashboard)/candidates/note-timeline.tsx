"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Note } from "@/lib/types";

const DEFAULT_PREVIEW_COUNT = 4;

/**
 * Khung timeline dùng chung cho lịch sử ghi chú/cuộc gọi — dùng ở cả Card
 * "Lịch sử ghi chú/cuộc gọi" (trang Chi tiết ứng viên, có sửa/xóa) và cột
 * "Tình trạng cuộc gọi" (danh sách Ứng viên, chỉ xem). Component chỉ lo sắp
 * xếp mới→cũ, khung timeline (đường nối mờ + khoảng cách rõ ràng giữa các
 * note) và nút Xem thêm/Thu gọn khi lịch sử dài — nội dung từng note do nơi
 * gọi tự quyết định qua renderNote (2 nơi khác nhau về việc có nút sửa/xóa
 * hay không, và về kích thước hiển thị).
 */
export function NoteTimeline({
  notes,
  previewCount = DEFAULT_PREVIEW_COUNT,
  renderNote,
}: {
  notes: Note[];
  previewCount?: number;
  renderNote: (note: Note) => ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sorted = [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (sorted.length === 0) {
    return null;
  }
  const hasMore = sorted.length > previewCount;
  const visible = isExpanded ? sorted : sorted.slice(0, previewCount);

  return (
    <div>
      <ul className="relative flex flex-col gap-3">
        {visible.length > 1 && (
          <div className="absolute top-2 bottom-2 left-[15px] w-px bg-slate-200" aria-hidden="true" />
        )}
        {visible.map((note) => (
          <li key={note.id} className="relative pl-8">
            <span className="absolute top-2 left-[11px] h-2 w-2 rounded-full bg-brand-400 ring-4 ring-white" />
            {renderNote(note)}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-2.5 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
              Thu gọn
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
              Xem thêm ({sorted.length - previewCount})
            </>
          )}
        </button>
      )}
    </div>
  );
}

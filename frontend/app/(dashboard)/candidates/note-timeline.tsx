"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Note } from "@/lib/types";

const DEFAULT_PREVIEW_COUNT = 4;

/**
 * Khung timeline dùng chung cho lịch sử ghi chú/cuộc gọi — dùng ở cả Card
 * "Lịch sử ghi chú/cuộc gọi" (trang Chi tiết ứng viên, có sửa/xóa, cỡ thường)
 * và cột "Tình trạng cuộc gọi" (danh sách Ứng viên, chỉ xem, cỡ gọn —
 * `compact` + `collapsedMaxHeight` để giữ chiều cao hàng cố định, tối ưu
 * "xem được nhiều Data" thay vì đọc toàn bộ lịch sử ngay trên danh sách).
 * Component chỉ lo sắp xếp mới→cũ, khung timeline (đường nối mờ + khoảng
 * cách giữa các note) và nút Xem thêm/Thu gọn khi lịch sử dài — nội dung
 * từng note do nơi gọi tự quyết định qua renderNote.
 */
export function NoteTimeline({
  notes,
  previewCount = DEFAULT_PREVIEW_COUNT,
  renderNote,
  compact = false,
  collapsedMaxHeight,
  expanded: expandedProp,
  onToggleExpanded,
}: {
  notes: Note[];
  previewCount?: number;
  renderNote: (note: Note) => ReactNode;
  /** Cỡ gọn hơn cho danh sách: đường/chấm timeline nhỏ hơn, khoảng cách hẹp hơn. */
  compact?: boolean;
  /** Chỉ áp dụng khi đang thu gọn — cắt chiều cao vùng danh sách (nút Xem thêm luôn hiện đầy đủ, không bị cắt). */
  collapsedMaxHeight?: number;
  /** Điều khiển trạng thái mở rộng từ bên ngoài (vd. để bọc thêm khung giới hạn chiều cao ở nơi gọi) — bỏ qua thì tự quản lý nội bộ. */
  expanded?: boolean;
  onToggleExpanded?: (next: boolean) => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = expandedProp ?? internalExpanded;

  function toggle() {
    const next = !isExpanded;
    if (onToggleExpanded) {
      onToggleExpanded(next);
    } else {
      setInternalExpanded(next);
    }
  }

  const sorted = [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (sorted.length === 0) {
    return null;
  }
  const hasMore = sorted.length > previewCount;
  const visible = isExpanded ? sorted : sorted.slice(0, previewCount);

  // UI Polish — tinh chỉnh mật độ hiển thị: chỉ thu hẹp thêm khoảng cách ở
  // chế độ compact (cột "Tình trạng cuộc gọi" trong danh sách) — chế độ
  // thường (trang Chi tiết ứng viên) giữ nguyên gap-3.
  const gapClass = compact ? "gap-0.5" : "gap-3";
  const itemPaddingClass = compact ? "pl-6" : "pl-8";
  const lineOffsetClass = compact ? "left-3" : "left-[15px]";
  const dotClass = compact
    ? "top-1.5 left-[9px] h-1.5 w-1.5"
    : "top-2 left-[11px] h-2 w-2";

  return (
    <div>
      <div
        className={!isExpanded && collapsedMaxHeight ? "overflow-hidden" : undefined}
        style={!isExpanded && collapsedMaxHeight ? { maxHeight: collapsedMaxHeight } : undefined}
      >
        <ul className={`relative flex flex-col ${gapClass}`}>
          {visible.length > 1 && (
            <div className={`absolute top-2 bottom-2 w-px bg-slate-200 ${lineOffsetClass}`} aria-hidden="true" />
          )}
          {visible.map((note) => (
            <li key={note.id} className={`relative ${itemPaddingClass}`}>
              <span className={`absolute rounded-full bg-brand-400 ring-4 ring-white ${dotClass}`} />
              {renderNote(note)}
            </li>
          ))}
        </ul>
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={toggle}
          className={`flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 ${
            compact ? "mt-1 text-[10px]" : "mt-2 text-xs"
          }`}
        >
          {isExpanded ? (
            <>
              <ChevronUp className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2} />
              Thu gọn
            </>
          ) : (
            <>
              <ChevronDown className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2} />
              Xem thêm (còn {sorted.length - previewCount} ghi chú)
            </>
          )}
        </button>
      )}
    </div>
  );
}

"use client";

import type { ReactNode, ThHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Tiêu đề cột bấm để sắp xếp (yêu cầu người dùng 2026-10-30): mọi cột Ngày
 * và STT trên thanh tiêu đề bấm trực tiếp để đổi chiều tăng dần (thấp → cao)
 * / giảm dần (cao → thấp). Cột ngày bấm lần đầu = giảm dần (mới nhất trước);
 * STT tăng dần = thứ tự mặc định của danh sách.
 */
export type SortOrder = "asc" | "desc";

export interface SortState<K extends string = string> {
  key: K;
  order: SortOrder;
}

/**
 * Bấm cột đang sắp → đổi chiều; bấm cột khác → `firstOrder`. Cột ngày mặc
 * định giảm dần — mới nhất trước (yêu cầu người dùng 2026-10-30).
 */
export function nextSort<K extends string>(
  current: SortState<K> | null,
  key: K,
  firstOrder: SortOrder = "desc",
): SortState<K> {
  if (current?.key === key) return { key, order: current.order === "asc" ? "desc" : "asc" };
  return { key, order: firstOrder };
}

/** Thêm `sort`/`order` vào query gửi backend. */
export function applySortParams(query: URLSearchParams, sort: SortState | null) {
  if (!sort) return;
  query.set("sort", sort.key);
  query.set("order", sort.order);
}

/**
 * Sắp danh sách ngay trên trình duyệt (bảng không phân trang). Giá trị
 * trống (null/"") luôn xếp cuối; trùng nhau giữ nguyên thứ tự cũ.
 */
export function sortRows<T>(rows: T[], order: SortOrder, value: (row: T) => string | number | null | undefined): T[] {
  const dir = order === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, v: value(row) }))
    .sort((a, b) => {
      const aEmpty = a.v === null || a.v === undefined || a.v === "";
      const bEmpty = b.v === null || b.v === undefined || b.v === "";
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const cmp = a.v! < b.v! ? -1 : a.v! > b.v! ? 1 : 0;
      return dir * cmp || a.index - b.index;
    })
    .map((x) => x.row);
}

export function SortableTh<K extends string>({
  sortKey,
  sort,
  onSort,
  firstOrder,
  children,
  className,
  ...rest
}: {
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (next: SortState<K>) => void;
  /** Chiều khi bấm lần đầu. Mặc định giảm dần (cột ngày); cột STT tự lấy tăng dần. */
  firstOrder?: SortOrder;
  children: ReactNode;
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, "onClick">) {
  const active = sort?.key === sortKey ? sort.order : null;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <th
      {...rest}
      className={cn("cursor-pointer select-none", className)}
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
      title={
        active === "asc"
          ? "Đang xếp tăng dần — bấm để xếp giảm dần"
          : active === "desc"
            ? "Đang xếp giảm dần — bấm để xếp tăng dần"
            : "Bấm để xếp tăng dần / giảm dần"
      }
      onClick={() => onSort(nextSort(sort, sortKey, firstOrder ?? (sortKey === "stt" ? "asc" : "desc")))}
    >
      <span className="inline-flex items-center justify-center gap-0.5 hover:opacity-80">
        {children}
        <Icon
          aria-hidden="true"
          className={cn("h-3 w-3 shrink-0", active ? "opacity-100" : "opacity-40")}
          strokeWidth={2.25}
        />
      </span>
    </th>
  );
}

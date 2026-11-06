"use client";

import { cn } from "@/lib/cn";
import { NOTE_COLORS } from "@/lib/note-colors";

export type NoteColorValue = (typeof NOTE_COLORS)[number]["value"];

/** Thứ tự hiển thị của bộ lọc "Đánh giá": Xanh, Đỏ, Vàng. */
const FILTER_ORDER: NoteColorValue[] = ["green", "red", "yellow"];

/**
 * Bộ lọc "Đánh giá" (2026-11-06) — 3 ô chữ nhật màu đúng như màu đánh dấu
 * ở từng data. Bấm 1 ô để lọc theo màu đó, bấm lại để bỏ lọc. Dùng chung cho
 * tab Tất cả và tab Chăm sóc.
 */
export function NoteColorFilter({
  value,
  onChange,
}: {
  value: NoteColorValue | "" | undefined;
  onChange: (next: NoteColorValue | "") => void;
}) {
  return (
    <div className="flex h-7 items-center gap-1.5" role="group" aria-label="Đánh giá">
      {FILTER_ORDER.map((color) => {
        const option = NOTE_COLORS.find((c) => c.value === color)!;
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            title={active ? `Đang lọc màu ${option.label} — bấm để bỏ lọc` : `Lọc data đánh dấu màu ${option.label}`}
            aria-label={option.label}
            aria-pressed={active}
            onClick={() => onChange(active ? "" : color)}
            className={cn(
              "h-5 w-8 rounded transition",
              option.swatch,
              active
                ? "ring-2 ring-slate-800 ring-offset-1"
                : value
                  ? "opacity-35 hover:opacity-70"
                  : "opacity-90 hover:opacity-100",
            )}
          />
        );
      })}
    </div>
  );
}

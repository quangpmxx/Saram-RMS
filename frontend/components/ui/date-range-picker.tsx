"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  computeDateRange,
  DATE_PRESET_OPTIONS,
  EMPTY_DATE_RANGE,
  formatDateRangeLabel,
  type DatePreset,
  type DateRangeValue,
} from "@/lib/date-range";
import { Button } from "./button";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

/** Lưới 42 ô (6 hàng x 7 cột), tuần bắt đầu Chủ nhật — chỉ để HIỂN THỊ lịch (khác quy ước "tuần bắt đầu Thứ 2" dùng tính preset "Tuần này/Tuần trước"). */
function buildMonthGrid(month: Date): Array<Date | null> {
  const first = startOfMonth(month);
  const startWeekday = first.getDay(); // CN=0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  return cells;
}

/**
 * Dự án phụ — nâng cấp toàn diện: bộ lọc ngày kiểu Google Analytics dùng
 * chung cho mọi trang có lọc theo ngày (yêu cầu trực tiếp người dùng, có
 * ảnh minh họa) — danh sách preset nhanh bên trái + lịch 2 tháng bên phải để
 * chọn khoảng tùy ý. Không có phần "So sánh" (xác nhận trực tiếp: bỏ, vì hệ
 * thống không có tính năng so sánh 2 giai đoạn). Dùng chung y hệt cho MỌI
 * trang (kể cả lọc theo đúng 1 ngày như Shuttle) — yêu cầu trực tiếp người
 * dùng: "cứ làm y hệt như ảnh anh gửi", không rút gọn riêng cho từng trang.
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  className,
  allowClear = false,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  placeholder?: string;
  className?: string;
  /** Thêm lựa chọn "Tất cả" ở đầu danh sách preset — dùng cho bộ lọc KHÔNG bắt buộc (vd Candidates: không lọc ngày vẫn xem được toàn bộ). */
  allowClear?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(
    null,
  );
  const [pending, setPending] = useState<DateRangeValue>(value);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseDateOnly(value.from) ?? new Date()));
  const [rangeStage, setRangeStage] = useState<"start" | "end">("start");

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function open() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 4;
    const panelWidth = 660;
    const panelHeight = 420;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceRight = window.innerWidth - rect.left;
    const openUpward = spaceBelow < panelHeight && rect.top > spaceBelow;
    const openRightAligned = spaceRight < panelWidth && rect.right >= panelWidth;

    setPosition({
      top: openUpward ? undefined : rect.bottom + GAP,
      bottom: openUpward ? window.innerHeight - rect.top + GAP : undefined,
      left: openRightAligned ? undefined : rect.left,
      right: openRightAligned ? window.innerWidth - rect.right : undefined,
    });
    setPending(value);
    setVisibleMonth(startOfMonth(parseDateOnly(value.from) ?? new Date()));
    setRangeStage("start");
    setIsOpen(true);
  }

  function pickPreset(preset: DatePreset) {
    const range = computeDateRange(preset);
    setPending({ preset, from: range.from, to: range.to });
    setVisibleMonth(startOfMonth(parseDateOnly(range.from) ?? new Date()));
    setRangeStage("start");
  }

  function pickDay(day: Date) {
    const iso = toDateOnly(day);
    if (rangeStage === "start") {
      setPending({ preset: "custom", from: iso, to: iso });
      setRangeStage("end");
      return;
    }
    if (iso < pending.from) {
      setPending({ preset: "custom", from: iso, to: pending.from });
    } else {
      setPending({ preset: "custom", from: pending.from, to: iso });
    }
    setRangeStage("start");
  }

  function confirm() {
    onChange(pending);
    setIsOpen(false);
  }

  const leftMonth = visibleMonth;
  const rightMonth = addMonths(visibleMonth, 1);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1 text-left text-xs text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
          {value.from || value.to ? formatDateRangeLabel(value) : placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: position.top, bottom: position.bottom, left: position.left, right: position.right }}
            className="fixed z-40 flex items-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15"
          >
            <div className="w-40 shrink-0 overflow-y-auto border-r border-slate-100 p-1.5">
              {allowClear && (
                <button
                  type="button"
                  onClick={() => setPending(EMPTY_DATE_RANGE)}
                  className={cn(
                    "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                    !pending.from && !pending.to ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "h-3 w-3 shrink-0 rounded-full border",
                      !pending.from && !pending.to ? "border-brand-600 bg-brand-600" : "border-slate-300",
                    )}
                  />
                  Tất cả
                </button>
              )}
              {DATE_PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => pickPreset(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                    pending.preset === option.value ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "h-3 w-3 shrink-0 rounded-full border",
                      pending.preset === option.value ? "border-brand-600 bg-brand-600" : "border-slate-300",
                    )}
                  />
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Tháng trước"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                </button>
                <div className="flex gap-6">
                  <MonthYearSelect month={leftMonth} onChange={(next) => setVisibleMonth(next)} />
                  <MonthYearSelect month={rightMonth} onChange={(next) => setVisibleMonth(addMonths(next, -1))} />
                </div>
                <button
                  type="button"
                  onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Tháng sau"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              <div className="mt-2 flex gap-4">
                <MonthGrid month={leftMonth} pending={pending} onPick={pickDay} />
                <MonthGrid month={rightMonth} pending={pending} onPick={pickDay} />
              </div>

              <p className="mt-1 text-[10px] text-slate-400">Ngày hiển thị theo Giờ TP Hồ Chí Minh</p>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  {pending.from ? formatDisplayDate(pending.from) : "—"}
                  {" – "}
                  {pending.to ? formatDisplayDate(pending.to) : "—"}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="xs" onClick={() => setIsOpen(false)}>
                    Hủy
                  </Button>
                  <Button type="button" size="xs" onClick={confirm} disabled={!pending.from && !allowClear}>
                    Cập nhật
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const YEAR_RANGE = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i);

/** Dropdown Tháng/Năm riêng cho từng lịch tháng — đúng thiết kế trong ảnh mẫu (khác nút "<"/">" ở ngoài chỉ lùi/tiến 1 tháng cho cả cụm). */
function MonthYearSelect({ month, onChange }: { month: Date; onChange: (next: Date) => void }) {
  return (
    <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
      <select
        value={month.getMonth()}
        onChange={(event) => onChange(new Date(month.getFullYear(), Number(event.target.value), 1))}
        className="cursor-pointer rounded border-0 bg-transparent py-0.5 pr-1 pl-1 hover:bg-slate-50 focus:outline-none"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i}>{`Tháng ${i + 1}`}</option>
        ))}
      </select>
      <select
        value={month.getFullYear()}
        onChange={(event) => onChange(new Date(Number(event.target.value), month.getMonth(), 1))}
        className="cursor-pointer rounded border-0 bg-transparent py-0.5 pr-1 pl-1 hover:bg-slate-50 focus:outline-none"
      >
        {YEAR_RANGE.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

function MonthGrid({
  month,
  pending,
  onPick,
}: {
  month: Date;
  pending: DateRangeValue;
  onPick: (day: Date) => void;
}) {
  const cells = buildMonthGrid(month);
  const today = toDateOnly(new Date());

  return (
    <div className="w-56">
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-slate-400">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {cells.map((day, index) => {
          if (!day) return <span key={index} />;
          const iso = toDateOnly(day);
          const isToday = iso === today;
          const isFrom = iso === pending.from;
          const isTo = iso === pending.to;
          const isInRange = pending.from && pending.to && iso > pending.from && iso < pending.to;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onPick(day)}
              className={cn(
                "mx-auto flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                isFrom || isTo ? "bg-brand-600 font-semibold text-white" : isInRange ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100",
                isToday && !isFrom && !isTo && "font-semibold text-brand-600",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

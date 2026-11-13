import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/payroll-api";

/**
 * Biểu đồ trang Tiền lương (2026-11-13) — HTML/CSS thuần, không thêm thư viện.
 * Màu lấy từ biến --pv-* (globals.css, có bản riêng cho giao diện tối). Chữ luôn dùng
 * màu chữ thường, màu chỉ nằm trên thanh/ô màu.
 */

/** 12.500.000 → "12,5 tr" — nhãn gọn trên biểu đồ. */
export const compactMoney = (n: number) =>
  Math.abs(n) >= 1e9
    ? `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`
    : Math.abs(n) >= 1e6
      ? `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`
      : formatMoney(n);

/** Thanh ngang: mỗi dòng 1 nhãn + 1 thanh + số. Dùng cho phân bố mức lương, lương theo vị trí. */
export function BarList({
  rows,
  format = (n) => n.toLocaleString("vi-VN"),
  unit = "",
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="payroll-viz flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="group grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm" title={`${r.label}: ${format(r.value)}${unit}${r.hint ? ` · ${r.hint}` : ""}`}>
          <span className="truncate text-slate-600">{r.label}</span>
          <div className="h-2.5 rounded-r bg-[var(--pv-track)]">
            <div
              className="h-full rounded-r bg-[var(--pv-1)] transition-[width,opacity] duration-300 group-hover:opacity-80"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 4 : 0 }}
            />
          </div>
          <span className="min-w-12 text-right font-medium text-slate-800 tabular-nums">
            {format(r.value)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Cột dọc theo thời gian (1 chuỗi): rê chuột vào cột để xem số; cột mới nhất luôn hiện số. */
export function ColumnChart({ points }: { points: { label: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="payroll-viz">
      <div className="flex h-44 items-end gap-2 border-b border-slate-200 pt-6">
        {points.map((p, i) => (
          <div key={p.label} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${p.label}: ${formatMoney(p.value)} đ`}>
            <span className={cn("mb-1 text-[11px] font-medium text-slate-700 tabular-nums whitespace-nowrap", i === points.length - 1 ? "" : "opacity-0 group-hover:opacity-100")}>
              {compactMoney(p.value)}
            </span>
            <div
              className="w-full max-w-7 rounded-t bg-[var(--pv-1)] transition-opacity group-hover:opacity-80"
              style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value > 0 ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {points.map((p) => (
          <span key={p.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-slate-500">{p.label}</span>
        ))}
      </div>
    </div>
  );
}

const SLOTS = ["--pv-1", "--pv-2", "--pv-3", "--pv-4", "--pv-5", "--pv-6"];

/** Cơ cấu 1 tổng thành các phần: 1 thanh chia đoạn + chú thích có số và %. Quá 6 phần thì gộp "Khác". */
export function SegmentedBar({ parts }: { parts: { label: string; value: number }[] }) {
  const positive = parts.filter((p) => p.value > 0);
  const shown = positive.slice(0, SLOTS.length).map((p, i) => ({ ...p, color: `var(${SLOTS[i]})` }));
  const rest = positive.slice(SLOTS.length).reduce((t, p) => t + p.value, 0);
  if (rest > 0) shown.push({ label: "Khác", value: rest, color: "var(--pv-other)" });
  const total = shown.reduce((t, p) => t + p.value, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-slate-400">Chưa có số liệu</p>;
  const pct = (v: number) => `${((v / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  return (
    <div className="payroll-viz flex flex-col gap-4">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded">
        {shown.map((p) => (
          <div key={p.label} className="h-full transition-opacity hover:opacity-80" style={{ width: `${(p.value / total) * 100}%`, minWidth: 3, background: p.color }} title={`${p.label}: ${formatMoney(p.value)} đ (${pct(p.value)})`} />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {shown.map((p) => (
          <li key={p.label} className="grid grid-cols-[auto_1fr_auto_3.5rem] items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="truncate text-slate-600">{p.label}</span>
            <span className="font-medium text-slate-800 tabular-nums">{formatMoney(p.value)}</span>
            <span className="text-right text-slate-400 tabular-nums">{pct(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

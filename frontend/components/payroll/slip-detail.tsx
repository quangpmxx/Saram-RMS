import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import { formatMoney, isIncome, type SlipBase, type SlipLine } from "@/lib/payroll-api";

/**
 * Phiếu lương theo mẫu Saram (2026-11-13): đầu phiếu (họ tên, lương cơ bản, ngày công |
 * ngày vào, ngày chính thức, vị trí), cột trái Chi tiết lương + Các khoản phụ cấp → Tổng
 * lương (1), cột phải Các khoản giảm trừ → Tổng (2), THỰC NHẬN (1)-(2), thông tin ngân hàng.
 * Dùng cho Kế toán (xem phiếu), trang "Phiếu lương" của nhân viên và xem trước mẫu
 * (`compact`: chữ nhỏ, dòng sát để vừa một màn hình).
 */
const COMPANY = "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ SARAM VINA";

const fmtDate = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "—");
/** 0 hiện "-" như phiếu Excel cũ, đỡ rối mắt. */
const money = (n: number) => (n ? formatMoney(n) : "-");

function InfoRow({ label, value, strong, compact }: { label: string; value: ReactNode; strong?: boolean; compact: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 border-b border-slate-100 last:border-0", compact ? "py-0.5" : "py-1.5")}>
      <span className="text-slate-500">{label}</span>
      <span className={cn("text-right text-slate-800", strong && "font-semibold text-slate-900")}>{value}</span>
    </div>
  );
}

function MoneyRow({ line, showFormula, compact }: { line: SlipLine; showFormula: boolean; compact: boolean }) {
  return (
    <li className={cn("flex items-baseline gap-3 border-b border-dashed border-slate-100 last:border-0", compact ? "py-0.5" : "py-1.5")}>
      <div className="min-w-0 grow">
        <div className="truncate text-slate-700">{line.name}</div>
        {showFormula && (
          <div className="truncate font-mono text-[10px] text-slate-400">{line.manual ? "nhập tay" : `= ${line.formula}`}</div>
        )}
        {line.error && <div className="text-[11px] text-red-600">Lỗi công thức: {line.error}</div>}
      </div>
      <span className={cn("shrink-0 tabular-nums", line.error ? "text-red-600" : line.value ? "font-medium text-slate-900" : "text-slate-300")}>
        {money(line.value)}
      </span>
    </li>
  );
}

function SectionTitle({ children, tone, compact }: { children: ReactNode; tone: "brand" | "rose"; compact: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between font-semibold tracking-wide uppercase",
        compact ? "px-3 py-1 text-[10px]" : "px-4 py-2 text-xs",
        tone === "brand" ? "bg-brand-50 text-brand-800" : "bg-rose-50 text-rose-800",
      )}
    >
      {children}
    </div>
  );
}

export function SlipDetail({
  slip,
  year,
  month,
  showFormula = false,
  compact = false,
}: {
  slip: SlipBase;
  year?: number;
  month?: number;
  showFormula?: boolean;
  compact?: boolean;
}) {
  const p = slip.profile;
  const i = slip.inputs;
  const salary = slip.lines.filter((l) => l.nature === "income");
  const allowances = slip.lines.filter((l) => l.nature === "allowance");
  const deductions = slip.lines.filter((l) => l.nature === "deduction");
  const totalIncome = slip.lines.filter((l) => isIncome(l.nature)).reduce((t, l) => t + l.value, 0);
  const totalDeduction = deductions.reduce((t, l) => t + l.value, 0);
  const period = year && month ? `THÁNG ${String(month).padStart(2, "0")}.${year}` : "";
  const padX = compact ? "px-3" : "px-4";
  const rowProps = { showFormula, compact };

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]", compact ? "text-xs" : "text-sm")}>
      {/* Đầu phiếu */}
      <div className={cn("bg-gradient-to-r from-brand-700 to-brand-600 text-white", compact ? "px-3 py-2" : "px-5 py-4")}>
        <div className={cn("font-medium tracking-wider text-white/70", compact ? "text-[9px]" : "text-[11px]")}>{COMPANY}</div>
        <div className={cn("font-bold tracking-wide", compact ? "text-sm" : "mt-0.5 text-lg")}>PHIẾU LƯƠNG NHÂN VIÊN {period}</div>
      </div>

      <div className={cn("grid gap-x-6 sm:grid-cols-2", compact ? "px-3 py-1.5" : "px-5 py-3")}>
        <div>
          <InfoRow compact={compact} label="Họ tên NV" value={p?.full_name ?? "—"} strong />
          <InfoRow compact={compact} label="Lương cơ bản" value={formatMoney(i.LUONG_CO_BAN ?? 0)} strong />
          <InfoRow
            compact={compact}
            label="Tổng ngày công"
            value={
              <>
                <span className="font-semibold text-slate-900">{(i.CONG_HUONG_LUONG ?? 0).toLocaleString("vi-VN", { minimumFractionDigits: 1 })}</span>
                <span className="text-slate-400"> / {i.CONG_CHUAN ?? 0}</span>
              </>
            }
          />
        </div>
        <div>
          <InfoRow compact={compact} label="Ngày bắt đầu làm" value={fmtDate(p?.hire_date)} />
          <InfoRow compact={compact} label="Ngày chính thức" value={fmtDate(p?.official_date)} />
          <InfoRow compact={compact} label="Vị trí" value={p ? p.position || ACCOUNT_ROLE_LABEL[p.role] : "—"} />
        </div>
      </div>

      {/* Hai cột tiền */}
      <div className="grid border-t border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-slate-200">
        <div className="flex flex-col">
          <SectionTitle tone="brand" compact={compact}>
            <span>Chi tiết lương</span>
            <span>Số tiền</span>
          </SectionTitle>
          <ul className={cn(padX, "py-0.5")}>
            {salary.map((l) => <MoneyRow key={l.code} line={l} {...rowProps} />)}
          </ul>
          {allowances.length > 0 && (
            <>
              <div className={cn(padX, "pt-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase")}>Các khoản phụ cấp</div>
              <ul className={cn(padX, "pb-0.5")}>
                {allowances.map((l) => <MoneyRow key={l.code} line={l} {...rowProps} />)}
              </ul>
            </>
          )}
          <div className={cn("mt-auto flex items-center justify-between border-t border-slate-200 bg-slate-50", padX, compact ? "py-1.5" : "py-2.5")}>
            <span className="font-semibold text-slate-700">Tổng lương (1)</span>
            <span className={cn("font-bold text-brand-700 tabular-nums", compact ? "text-sm" : "text-base")}>{formatMoney(totalIncome)}</span>
          </div>
        </div>

        <div className="flex flex-col border-t border-slate-200 sm:border-t-0">
          <SectionTitle tone="rose" compact={compact}>
            <span>Các khoản giảm trừ</span>
            <span>Số tiền</span>
          </SectionTitle>
          <ul className={cn(padX, "py-0.5")}>
            {deductions.map((l) => <MoneyRow key={l.code} line={l} {...rowProps} />)}
          </ul>
          <div className={cn("flex items-center justify-between border-y border-slate-200 bg-slate-50", padX, compact ? "py-1.5" : "py-2.5")}>
            <span className="font-semibold text-slate-700">Tổng giảm trừ (2)</span>
            <span className={cn("font-bold text-rose-600 tabular-nums", compact ? "text-sm" : "text-base")}>{formatMoney(totalDeduction)}</span>
          </div>

          {/* Thực nhận */}
          <div className={cn("rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 text-center ring-1 ring-emerald-200", compact ? "m-2 p-2" : "m-4 p-4")}>
            <div className={cn("font-semibold tracking-wider text-emerald-700 uppercase", compact ? "text-[10px]" : "text-xs")}>Thực nhận (1) − (2)</div>
            <div className={cn("font-bold text-emerald-700 tabular-nums", compact ? "text-lg" : "mt-1 text-2xl")}>{formatMoney(slip.net_pay)} đ</div>
          </div>

          <div className={cn("mt-auto", padX, compact ? "pb-1.5" : "pb-3")}>
            <InfoRow compact={compact} label="Số TK" value={<span className="font-mono font-semibold">{p?.bank_account_number || "—"}</span>} />
            <InfoRow compact={compact} label="Ngân hàng" value={<span className="font-semibold">{p?.bank_name || "—"}</span>} />
            <InfoRow compact={compact} label="Chủ TK" value={<span className="font-semibold">{p?.bank_account_holder || "—"}</span>} />
          </div>
        </div>
      </div>

      {slip.note && <p className={cn("border-t border-slate-200 text-slate-500", compact ? "px-3 py-1.5 text-[11px]" : "px-5 py-2.5 text-xs")}>Ghi chú: {slip.note}</p>}
    </div>
  );
}

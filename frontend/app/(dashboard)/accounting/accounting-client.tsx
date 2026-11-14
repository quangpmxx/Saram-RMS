"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  BarChart3,
  Blocks,
  Calculator,
  CalendarCheck,
  Handshake,
  LayoutDashboard,
  Sheet,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ViewOnlyBadge } from "@/components/ui/view-only-badge";
import { cn } from "@/lib/cn";
import { useSetPageTitle } from "@/lib/page-title-context";
import { payrollApi, type PayrollVariable } from "@/lib/payroll-api";
import type { ModulePermissionLevel } from "@/lib/types";
import { DataPanel, PayoutPanel } from "./payroll-data";
import { PayrollPanel } from "./payroll-panel";
import { OverviewPanel, ReportsPanel } from "./payroll-reports";
import { AccountSettingsPanel, CommissionRatesPanel, ComponentsPanel, TemplatesPanel } from "./payroll-settings";

/**
 * Kế toán = Tiền lương (2026-11-13). Menu bên trái xếp theo đúng thứ tự làm việc như
 * phần mềm tiền lương tham khảo: Tổng quan → Thành phần lương → Mẫu bảng lương →
 * Dữ liệu tính lương → Tính lương → Chi trả → Báo cáo → Nhân viên.
 */
type TabKey =
  | "overview"
  | "components"
  | "templates"
  | "data-attendance"
  | "data-sales"
  | "commission"
  | "payroll"
  | "payout"
  | "reports"
  | "accounts";

const NAV: { group?: string; items: { key: TabKey; label: string; icon: LucideIcon }[] }[] = [
  {
    items: [
      { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
      { key: "components", label: "Thành phần lương", icon: Blocks },
      { key: "templates", label: "Mẫu bảng lương", icon: Sheet },
    ],
  },
  {
    group: "Dữ liệu tính lương",
    items: [
      { key: "data-attendance", label: "Chấm công", icon: CalendarCheck },
      { key: "data-sales", label: "Doanh số", icon: TrendingUp },
      { key: "commission", label: "Hoa hồng công ty", icon: Handshake },
    ],
  },
  {
    group: "Lương tháng",
    items: [
      { key: "payroll", label: "Tính lương", icon: Calculator },
      { key: "payout", label: "Chi trả", icon: Banknote },
      { key: "reports", label: "Báo cáo", icon: BarChart3 },
      { key: "accounts", label: "Nhân viên", icon: Users },
    ],
  },
];
const ALL_ITEMS = NAV.flatMap((g) => g.items);

export function AccountingClient({
  permissionLevel,
  initialYear,
  initialMonth,
}: {
  permissionLevel: ModulePermissionLevel;
  initialYear: number;
  initialMonth: number;
}) {
  useSetPageTitle("Kế toán — Tiền lương");
  const canEdit = permissionLevel === "edit";
  const [tab, setTab] = useState<TabKey>("overview");
  const [variables, setVariables] = useState<PayrollVariable[]>([]);
  const goTab = (t: string) => setTab(t as TabKey);
  const current = ALL_ITEMS.find((i) => i.key === tab)!;

  useEffect(() => {
    payrollApi.variables().then(setVariables).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Điện thoại: thanh chọn mục cuộn ngang. Máy tính: menu dọc bên trái. */}
      <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
        {ALL_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
              tab === item.key ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </nav>
      <aside className="sticky top-4 hidden w-56 shrink-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-900/[0.03] lg:block">
        {NAV.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-2 border-t border-slate-100 pt-2" : ""}>
            {group.group && <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{group.group}</div>}
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  tab === item.key ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <item.icon className="size-[18px] shrink-0" strokeWidth={tab === item.key ? 2.2 : 1.8} />
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div className="flex min-w-0 grow flex-col gap-4">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold text-slate-900">{current.label}</h1>
          {!canEdit && <ViewOnlyBadge />}
        </header>

        {tab === "overview" && <OverviewPanel onGoTab={goTab} />}
        {tab === "components" && <ComponentsPanel canEdit={canEdit} variables={variables} />}
        {tab === "templates" && <TemplatesPanel canEdit={canEdit} />}
        {tab === "data-attendance" && <DataPanel key="attendance" kind="attendance" onGoTab={goTab} />}
        {tab === "data-sales" && <DataPanel key="sales" kind="sales" onGoTab={goTab} />}
        {tab === "commission" && <CommissionRatesPanel canEdit={canEdit} />}
        {tab === "payroll" && <PayrollPanel canEdit={canEdit} initialYear={initialYear} initialMonth={initialMonth} />}
        {tab === "payout" && <PayoutPanel canEdit={canEdit} onGoTab={goTab} />}
        {tab === "reports" && <ReportsPanel />}
        {tab === "accounts" && <AccountSettingsPanel canEdit={canEdit} />}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { BarChart3, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AccountRole } from "@/lib/types";
import { DashboardCharts, type ChartsData } from "./dashboard-charts";
import type { CareProgressResult } from "@/lib/care-warehouse";

type Tab = "detail" | "charts";

/**
 * Trang chủ Dashboard có 2 thẻ (2026-11-23): "Biểu đồ" (đứng trước, mở mặc định) =
 * hiệu suất chung bằng biểu đồ; "Chi tiết" = Dashboard cũ giữ nguyên. Thẻ đang ẩn
 * chỉ bị giấu đi (không gỡ) để giữ bộ lọc + cập nhật realtime.
 */
export function DashboardTabs({
  currentUserRole,
  initialCharts,
  initialCare,
  children,
}: {
  currentUserRole: AccountRole;
  /** Số liệu tháng hiện tại tải sẵn ở server (null = để thẻ tự tải). */
  initialCharts: ChartsData | null;
  initialCare: CareProgressResult | null;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("charts");

  const tabs: [Tab, string, typeof LayoutGrid][] = [
    ["charts", "Biểu đồ", BarChart3],
    ["detail", "Chi tiết", LayoutGrid],
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto flex w-full max-w-7xl">
        <div
          className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium shadow-sm"
          role="tablist"
        >
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors",
                tab === key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* pt-3 bù cho -mt-3 sẵn có ở gốc DashboardClient (giờ không còn bị nuốt). */}
      <div className={cn("pt-3", tab !== "detail" && "hidden")}>{children}</div>
      <div className={cn("mx-auto w-full max-w-7xl", tab !== "charts" && "hidden")}>
        <DashboardCharts
          currentUserRole={currentUserRole}
          initialData={initialCharts}
          initialCare={initialCare}
        />
      </div>
    </div>
  );
}

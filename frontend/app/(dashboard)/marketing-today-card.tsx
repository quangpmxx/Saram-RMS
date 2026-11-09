"use client";

import { useEffect, useState } from "react";
import { clientApi } from "@/lib/api-client";
import { Card } from "@/components/ui/card";

interface MarketingToday {
  spend: number;
  data_count: number;
  cost_per_data: number | null;
  yesterday_spend: number;
  interview_count: number;
  cost_per_interview: number | null;
}

// Hiện khi có quyền dashboard.mkt_cost (phân quyền chi tiết 2026-11-07).

const vnd = (n: number | null) => (n === null ? "—" : `${Math.round(n).toLocaleString("vi-VN")} ₫`);

/**
 * Khối Chi phí Marketing trên Dashboard — theo bộ lọc "Khoảng thời gian" chung
 * (2026-11-06; trước chỉ hôm nay). Trống cả 2 mốc = hôm nay. Tự làm mới 5 phút/lần.
 */
export function MarketingTodayCard({
  from,
  to,
  periodLabel,
}: {
  from: string;
  to: string;
  /** Chú thích khoảng thời gian đang lọc, hiện sau tiêu đề. */
  periodLabel?: string;
}) {
  const [data, setData] = useState<MarketingToday | null>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const load = () =>
      clientApi<MarketingToday>(`/marketing-hub/today?${query.toString()}`)
        .then(setData)
        .catch(() => {});
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 5 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [from, to]);

  const tiles = [
    { label: "Chi phí MKT", value: vnd(data?.spend ?? null), cls: "bg-brand-50 text-brand-700" },
    { label: "Data thu được", value: data ? data.data_count.toLocaleString("vi-VN") : "—", cls: "bg-sky-50 text-sky-700" },
    { label: "Chi phí/data", value: vnd(data?.cost_per_data ?? null), cls: "bg-amber-50 text-amber-700" },
    {
      label: "Chi phí/phỏng vấn",
      value: vnd(data?.cost_per_interview ?? null),
      cls: "bg-rose-50 text-rose-700",
      title: data
        ? `Chi tiêu lùi 1 ngày so với kỳ đang chọn ${vnd(data.yesterday_spend)} ÷ ${data.interview_count} người đưa đón trong kỳ`
        : undefined,
    },
  ];

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        Chi phí Marketing{" "}
        {periodLabel && <span className="font-normal text-slate-500">({periodLabel})</span>}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} title={t.title} className={`rounded-xl p-2 text-center ${t.cls}`}>
            <p className="text-base font-bold">{data ? t.value : "—"}</p>
            <p className="text-xs opacity-70">{t.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

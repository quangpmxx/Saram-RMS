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

/** Vai trò xem được khối Marketing (khớp quyền GET /marketing-hub/today). */
export const MARKETING_TODAY_ROLES = ["admin", "manager", "mkt"];

const vnd = (n: number | null) => (n === null ? "—" : `${Math.round(n).toLocaleString("vi-VN")} ₫`);

/** Khối Marketing hôm nay trên Dashboard — số liệu hiện tại, tự làm mới 5 phút/lần, không theo bộ lọc. */
export function MarketingTodayCard() {
  const [data, setData] = useState<MarketingToday | null>(null);

  useEffect(() => {
    const load = () =>
      clientApi<MarketingToday>("/marketing-hub/today")
        .then(setData)
        .catch(() => {});
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 5 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const tiles = [
    { label: "Chi phí MKT", value: vnd(data?.spend ?? null), cls: "bg-brand-50 text-brand-700" },
    { label: "Data thu được", value: data ? data.data_count.toLocaleString("vi-VN") : "—", cls: "bg-sky-50 text-sky-700" },
    { label: "Chi phí/data", value: vnd(data?.cost_per_data ?? null), cls: "bg-amber-50 text-amber-700" },
    {
      label: "Chi phí/phỏng vấn",
      value: vnd(data?.cost_per_interview ?? null),
      cls: "bg-rose-50 text-rose-700",
      title: data
        ? `Chi tiêu hôm qua ${vnd(data.yesterday_spend)} ÷ ${data.interview_count} người đưa đón hôm nay`
        : undefined,
    },
  ];

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">Marketing hôm nay</h2>
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

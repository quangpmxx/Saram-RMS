"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Database,
  HeartHandshake,
  type LucideIcon,
  Megaphone,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserCheck,
} from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { AccountRole } from "@/lib/types";
import type { CareProgressResult } from "@/lib/care-warehouse";
import { CARE_PROGRESS_ROLES } from "@/components/care-progress/care-progress-block";
import { Card } from "@/components/ui/card";

/** Kết quả GET /dashboard/charts — xem DashboardService.getCharts(). */
interface PeriodStats {
  new_leads: number;
  interview_scheduled: number;
  attended: number;
  no_show: number;
  passed: number;
  failed: number;
  employed: number;
  spend: number | null;
}
interface ChartsData {
  year: number;
  month: number | null;
  period: PeriodStats;
  previous: PeriodStats;
  by_team: {
    team_id: string | null;
    team_name: string;
    interview_scheduled: number;
    passed: number;
  }[];
  top_passed: {
    account_id: string;
    name: string;
    avatar_url: string | null;
    team_name: string | null;
    passed: number;
  }[];
  /** Người đỗ PV nhiều nhất của từng nhóm. */
  top_by_team: {
    account_id: string;
    name: string;
    team_id: string | null;
    team_name: string | null;
    passed: number;
  }[];
  monthly: {
    month: number;
    new_leads: number;
    interview_scheduled: number;
    passed: number;
    spend: number | null;
  }[];
}

/** Màu biểu đồ — cố định theo thứ tự, không đổi theo hạng. */
const C = {
  blue: "#2563eb",
  sky: "#38bdf8",
  green: "#10b981",
  orange: "#f97316",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  rose: "#f43f5e",
  gray: "#cbd5e1",
};
const TEAM_COLORS = [C.blue, C.orange, C.green, C.violet, C.amber, C.sky];
const FUNNEL_COLORS = ["#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa"];

const TINY_SELECT =
  "h-6 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 focus:border-brand-400 focus:outline-none";

const num = (n: number) => n.toLocaleString("vi-VN");
const pct = (a: number, b: number) =>
  b > 0 ? Math.round((a / b) * 1000) / 10 : 0;
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} ₫`;
function shortVnd(n: number): string {
  if (n >= 1e9)
    return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (n >= 1e6)
    return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}
/** Mốc trục Y tròn số (1-2-2,5-5 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function vnNow() {
  const [y, m] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year: y, month: m };
}

export function DashboardCharts({
  currentUserRole,
}: {
  currentUserRole: AccountRole;
}) {
  const now = vnNow();
  const [year, setYear] = useState(now.year);
  /** 0 = cả năm. */
  const [month, setMonth] = useState(now.month);
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams({ year: String(year) });
    if (month) q.set("month", String(month));
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      clientApi<ChartsData>(`/dashboard/charts?${q.toString()}`)
        .then((d) => {
          if (!alive) return;
          setData(d);
          setError("");
        })
        .catch(
          (e: unknown) =>
            alive &&
            setError(e instanceof Error ? e.message : "Không tải được số liệu"),
        )
        .finally(() => alive && setLoading(false));
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [year, month]);

  const years = useMemo(
    () => Array.from({ length: 4 }, (_, i) => now.year - i),
    [now.year],
  );
  const periodLabel = month ? `Tháng ${month}/${year}` : `Năm ${year}`;
  const prevLabel = month ? "tháng trước" : "năm trước";
  const p = data?.period;
  const showSpend = p?.spend !== null && p?.spend !== undefined;

  return (
    <div
      className={cn(
        "space-y-3 transition-opacity",
        loading && data && "opacity-60",
      )}
    >
      {/* Bộ lọc tháng / năm — 1 dòng siêu gọn */}
      <Card className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
        <p className="text-xs text-slate-500">
          <b className="font-semibold text-slate-900">{periodLabel}</b>
        </p>
        <div className="flex items-center gap-1">
          <div className="flex rounded-md bg-slate-100 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => {
                setYear(now.year);
                setMonth(now.month);
              }}
              className={cn(
                "rounded px-2 py-0.5",
                year === now.year && month === now.month
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => setMonth(0)}
              className={cn(
                "rounded px-2 py-0.5",
                month === 0
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Cả năm
            </button>
          </div>
          <select
            className={TINY_SELECT}
            aria-label="Tháng"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            <option value={0}>Cả năm</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Tháng {i + 1}
              </option>
            ))}
          </select>
          <select
            className={TINY_SELECT}
            aria-label="Năm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {error && <Card className="p-4 text-sm text-rose-600">{error}</Card>}

      {/* Ô số chính */}
      <div
        className={cn(
          "grid grid-cols-2 gap-2 sm:grid-cols-3",
          showSpend ? "lg:grid-cols-6" : "lg:grid-cols-5",
        )}
      >
        <Kpi
          icon={Database}
          label="Data mới"
          value={p?.new_leads}
          prev={data?.previous.new_leads}
          tone="blue"
          prevLabel={prevLabel}
        />
        <Kpi
          icon={CalendarCheck}
          label="Hẹn PV"
          value={p?.interview_scheduled}
          prev={data?.previous.interview_scheduled}
          tone="sky"
          prevLabel={prevLabel}
        />
        <Kpi
          icon={UserCheck}
          label="Đến PV"
          value={p?.attended}
          prev={data?.previous.attended}
          tone="violet"
          prevLabel={prevLabel}
        />
        <Kpi
          icon={Trophy}
          label="Đỗ PV"
          value={p?.passed}
          prev={data?.previous.passed}
          tone="green"
          prevLabel={prevLabel}
        />
        <Kpi
          icon={HeartHandshake}
          label="Đi làm"
          value={p?.employed}
          prev={data?.previous.employed}
          tone="amber"
          prevLabel={prevLabel}
        />
        {showSpend && (
          <Kpi
            icon={Megaphone}
            label="Chi phí MKT"
            value={p?.spend ?? undefined}
            prev={data?.previous.spend ?? undefined}
            tone="orange"
            prevLabel={prevLabel}
            format={shortVnd}
            // Chi phí tăng không phải tin tốt → đảo màu.
            invert
          />
        )}
      </div>

      {/* Phễu + 2 biểu đồ tròn */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Phễu tuyển dụng"
        >
          <Funnel p={p} />
        </ChartCard>
        <ChartCard
          title="Hiệu suất phỏng vấn"
          top
        >
          <Pie
            centerLabel="Tổng hẹn PV"
            slices={
              p
                ? [
                    { label: "Đỗ PV", value: p.passed, color: C.green },
                    { label: "Trượt PV", value: p.failed, color: C.orange },
                    { label: "Bùng PV", value: p.no_show, color: C.rose },
                    {
                      label: "Chưa có kết quả",
                      value: Math.max(
                        0,
                        p.interview_scheduled - p.passed - p.failed - p.no_show,
                      ),
                      color: C.gray,
                    },
                  ]
                : []
            }
          />
          <TopList
            title="Top đỗ PV"
            items={(data?.top_passed ?? []).map((t) => ({
              key: t.account_id,
              name: t.name,
              value: t.passed,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Hẹn PV theo nhóm"
          top
        >
          <Pie
            centerLabel="Tổng lịch hẹn"
            slices={teamSlices(data?.by_team ?? [])}
          />
          <TopList
            title="Top 1 đỗ PV từng nhóm"
            items={(data?.top_by_team ?? []).map((t) => ({
              key: t.account_id,
              name: t.name,
              tag: t.team_name ?? "",
              value: t.passed,
            }))}
          />
        </ChartCard>
      </div>

      {/* Biểu đồ cột theo tháng */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`Hẹn PV và Đỗ PV theo tháng · ${year}`}
          legend={[
            { label: "Hẹn PV", color: C.blue },
            { label: "Đỗ PV", color: C.green },
          ]}
        >
          <MonthBars
            highlight={month}
            series={[
              {
                key: "Hẹn PV",
                color: C.blue,
                values: data?.monthly.map((m) => m.interview_scheduled) ?? [],
              },
              {
                key: "Đỗ PV",
                color: C.green,
                values: data?.monthly.map((m) => m.passed) ?? [],
              },
            ]}
            extra={(i) => {
              const m = data?.monthly[i];
              return m
                ? `Tỉ lệ đỗ/hẹn: ${pct(m.passed, m.interview_scheduled)}%`
                : "";
            }}
          />
        </ChartCard>
        {showSpend ? (
          <ChartCard
            title={`Chi phí Marketing theo tháng · ${year}`}
            subtitle={
              p?.spend !== null && p ? (
                <>
                  {periodLabel}: <Money>{vnd(p.spend ?? 0)}</Money> · Chi phí/data{" "}
                  <Money>{p.new_leads ? vnd((p.spend ?? 0) / p.new_leads) : "—"}</Money> · Chi phí/hẹn PV{" "}
                  <Money>
                    {p.interview_scheduled ? vnd((p.spend ?? 0) / p.interview_scheduled) : "—"}
                  </Money>
                </>
              ) : (
                " "
              )
            }
          >
            <MonthBars
              highlight={month}
              format={shortVnd}
              tooltipFormat={vnd}
              series={[
                {
                  key: "Chi phí",
                  color: C.orange,
                  values: data?.monthly.map((m) => m.spend ?? 0) ?? [],
                },
              ]}
              extra={(i) => {
                const m = data?.monthly[i];
                if (!m || !m.new_leads) return "";
                const perData = `Data: ${num(m.new_leads)} · Chi phí/data: ${vnd((m.spend ?? 0) / m.new_leads)}`;
                return m.interview_scheduled
                  ? `${perData} · Chi phí/hẹn PV: ${vnd((m.spend ?? 0) / m.interview_scheduled)}`
                  : perData;
              }}
            />
          </ChartCard>
        ) : (
          <ChartCard
            title={`Data mới theo tháng · ${year}`}
            subtitle="Số data tải lên mỗi tháng"
          >
            <MonthBars
              highlight={month}
              series={[
                {
                  key: "Data mới",
                  color: C.sky,
                  values: data?.monthly.map((m) => m.new_leads) ?? [],
                },
              ]}
            />
          </ChartCard>
        )}
      </div>

      {CARE_PROGRESS_ROLES.includes(currentUserRole) && (
        <CareProgress year={year} month={month || now.month} />
      )}
    </div>
  );
}

function teamSlices(rows: ChartsData["by_team"]) {
  // Tối đa 5 nhóm có màu riêng, còn lại gộp "Khác".
  const named = rows.filter((r) => r.team_id);
  const top = named.slice(0, 5);
  const rest = [...named.slice(5), ...rows.filter((r) => !r.team_id)];
  const slices = top.map((r, i) => ({
    label: r.team_name,
    value: r.interview_scheduled,
    color: TEAM_COLORS[i],
  }));
  const restSum = rest.reduce((s, r) => s + r.interview_scheduled, 0);
  if (restSum > 0)
    slices.push({
      label: rest.length === 1 ? rest[0].team_name : "Khác",
      value: restSum,
      color: C.gray,
    });
  return slices;
}

// card: nền + viền của cả ô số (mỗi ô một màu). "!" vì Card đã có sẵn bg-white/border-slate-200.
const TONES: Record<string, { bg: string; fg: string; card: string }> = {
  blue: { bg: "bg-white", fg: "text-blue-600", card: "bg-blue-50! border-blue-100!" },
  sky: { bg: "bg-white", fg: "text-sky-600", card: "bg-sky-50! border-sky-100!" },
  violet: { bg: "bg-white", fg: "text-violet-600", card: "bg-violet-50! border-violet-100!" },
  green: { bg: "bg-white", fg: "text-emerald-600", card: "bg-emerald-50! border-emerald-100!" },
  amber: { bg: "bg-white", fg: "text-amber-600", card: "bg-amber-50! border-amber-100!" },
  orange: { bg: "bg-white", fg: "text-orange-600", card: "bg-orange-50! border-orange-100!" },
};

function Kpi({
  icon: Icon,
  label,
  value,
  prev,
  tone,
  prevLabel,
  format = num,
  invert = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  prev: number | undefined;
  tone: keyof typeof TONES;
  prevLabel: string;
  format?: (n: number) => string;
  invert?: boolean;
}) {
  const change =
    value !== undefined && prev
      ? Math.round(((value - prev) / prev) * 1000) / 10
      : null;
  const good = change !== null && (invert ? change < 0 : change > 0);
  const t = TONES[tone];
  return (
    <Card className={cn("flex flex-col items-center gap-0.5 px-2 py-2 text-center", t.card)}>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-md",
            t.bg,
            t.fg,
          )}
        >
          <Icon className="size-3" />
        </span>
        {label}
      </span>
      <p className="text-lg font-bold leading-tight tabular-nums text-slate-900">
        {value === undefined ? "—" : format(value)}
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-1 text-[10px] text-slate-500">
        {change === null || change === 0 ? (
          <span>{prev === 0 ? `${prevLabel}: 0` : `Bằng ${prevLabel}`}</span>
        ) : (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                good ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {change > 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {change > 0 ? "+" : ""}
              {change.toLocaleString("vi-VN")}%
            </span>
            <span>so với {prevLabel}</span>
          </>
        )}
      </p>
    </Card>
  );
}

/** Số tiền nổi bật (đỏ) trong dòng phụ của biểu đồ. */
function Money({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-red-600">{children}</b>;
}

function ChartCard({
  title,
  subtitle,
  legend,
  top = false,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  legend?: { label: string; color: string }[];
  /** true = nội dung dồn lên trên (biểu đồ tròn + Top bên dưới). */
  top?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex gap-3 text-xs text-slate-600">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: l.color }}
                />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div
        className={cn(
          "flex flex-1 flex-col",
          top ? "justify-start gap-3" : "justify-center",
        )}
      >
        {children}
      </div>
    </Card>
  );
}

/** Phễu hình thang đều — độ rộng chỉ tạo dáng, con số mới là số thật. */
function Funnel({ p }: { p: PeriodStats | undefined }) {
  const steps = [
    { label: "Data mới", value: p?.new_leads ?? 0 },
    { label: "Hẹn PV", value: p?.interview_scheduled ?? 0 },
    { label: "Đến PV", value: p?.attended ?? 0 },
    { label: "Đỗ PV", value: p?.passed ?? 0 },
    { label: "Đi làm", value: p?.employed ?? 0 },
  ];
  const w = (i: number) => 100 - i * 13;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-[3px]">
        {steps.map((s, i) => {
          const top = w(i);
          const bot = w(i + 1);
          const clip = `polygon(${(100 - top) / 2}% 0, ${(100 + top) / 2}% 0, ${(100 + bot) / 2}% 100%, ${(100 - bot) / 2}% 100%)`;
          return (
            <div key={s.label} className="group flex items-center gap-2">
              {/* Rê chuột: tầng đó phình to + nổi lên (bóng đổ đặt ở lớp ngoài vì clip-path cắt mất bóng). */}
              <div className="relative flex-1 cursor-default transition-transform duration-200 ease-out group-hover:z-10 group-hover:scale-[1.07] group-hover:drop-shadow-[0_6px_10px_rgba(30,64,175,0.4)]">
                <div
                  className="flex h-11 items-center justify-center gap-1.5 text-[13px] text-white transition-[filter] duration-200 group-hover:brightness-110"
                  style={{ background: FUNNEL_COLORS[i], clipPath: clip }}
                  title={`${s.label}: ${num(s.value)}`}
                >
                  <span className="font-medium">{s.label}</span>
                  <b className="tabular-nums">{num(s.value)}</b>
                </div>
              </div>
              <span className="w-12 text-right text-xs font-medium tabular-nums text-slate-500">
                {i === 0
                  ? ""
                  : `${pct(s.value, steps[i - 1].value).toLocaleString("vi-VN")}%`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">
        Tỉ lệ chốt hẹn:{" "}
        <b className="text-slate-900">
          {pct(steps[1].value, steps[0].value).toLocaleString("vi-VN")}%
        </b>
      </p>
    </div>
  );
}

const MEDALS = [
  "bg-amber-400 text-white",
  "bg-slate-400 text-white",
  "bg-orange-700/80 text-white",
];

/** Top 1-2-3 dưới biểu đồ tròn (xếp theo số đỗ PV) — gọn 1 dòng/người, chừa chỗ cho biểu đồ. */
function TopList({
  title,
  items,
}: {
  title: string;
  /** tag = tên nhóm, hiện thay cho số thứ hạng. */
  items: { key: string; name: string; tag?: string; value: number }[];
}) {
  return (
    <div className="border-t border-slate-100 pt-2">
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
        <Trophy className="size-3.5 text-amber-500" />
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">Chưa có ai đỗ PV trong kỳ này</p>
      ) : (
        <ol className="space-y-1">
          {items.map((it, i) => (
            <li key={it.key} className="flex items-center gap-1.5 text-[12px]">
              {it.tag !== undefined ? (
                <span
                  className="max-w-20 shrink-0 truncate rounded bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700"
                  title={it.tag}
                >
                  {it.tag}
                </span>
              ) : (
                <span
                  className={cn(
                    "flex size-[17px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    MEDALS[i],
                  )}
                >
                  {i + 1}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-slate-700" title={it.name}>
                {it.name}
              </span>
              <b className="tabular-nums text-emerald-600">{num(it.value)}</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Biểu đồ quạt (hình tròn đặc chia miếng) — rê chuột lên miếng nào thì miếng đó nhô ra. */
function Pie({
  slices,
  centerLabel,
}: {
  slices: { label: string; value: number; color: string }[];
  /** Nhãn dòng tổng trong chú thích. */
  centerLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((sum, x) => sum + x.value, 0);
  const R = 80;
  const CX = 90;
  const CY = 90;
  const visible = slices.filter((x) => x.value > 0).length;
  const point = (angle: number, r: number) => [
    CX + r * Math.sin(angle),
    CY - r * Math.cos(angle),
  ];
  let start = 0;
  const wedges = slices.map((sl, i) => {
    const sweep = total > 0 ? (sl.value / total) * Math.PI * 2 : 0;
    const mid = start + sweep / 2;
    const [x1, y1] = point(start, R);
    const [x2, y2] = point(start + sweep, R);
    const large = sweep > Math.PI ? 1 : 0;
    const d =
      visible === 1
        ? `M${CX},${CY - R}A${R},${R} 0 1 1 ${CX - 0.01},${CY - R}Z`
        : `M${CX},${CY}L${x1},${y1}A${R},${R} 0 ${large} 1 ${x2},${y2}Z`;
    const [lx, ly] = point(mid, R * 0.62);
    // Miếng đang trỏ nhô ra theo hướng giữa miếng.
    const [dx, dy] = hover === i && visible > 1 ? [Math.sin(mid) * 7, -Math.cos(mid) * 7] : [0, 0];
    start += sweep;
    return { sl, i, d, lx, ly, dx, dy, share: pct(sl.value, total) };
  });
  return (
    <div className="flex items-center gap-3">
      <div className="relative size-32 shrink-0 sm:size-40">
        <svg viewBox="0 0 180 180" className="size-full overflow-visible">
          {total === 0 && <circle cx={CX} cy={CY} r={R} fill="#f1f5f9" />}
          {total > 0 &&
            wedges
              .filter((w) => w.sl.value > 0)
              .map((w) => (
                <g
                  key={w.sl.label}
                  className="pointer-events-none transition-transform duration-200 ease-out"
                  style={{
                    transform: `translate(${w.dx}px, ${w.dy}px)`,
                    opacity: hover === null || hover === w.i ? 1 : 0.55,
                    filter:
                      hover === w.i
                        ? "drop-shadow(0 4px 6px rgba(15,23,42,0.25))"
                        : undefined,
                  }}
                >
                  <path
                    d={w.d}
                    fill={w.sl.color}
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {w.share >= 8 && (
                    <text
                      x={w.lx}
                      y={w.ly + 4}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fill="#fff"
                      className="pointer-events-none"
                    >
                      {Math.round(w.share)}%
                    </text>
                  )}
                </g>
              ))}
          {/* Lớp nhận chuột ĐỨNG YÊN (trong suốt, không nhô ra): tránh nhấp nháy khi miếng
              nhô ra rồi tuột khỏi con trỏ ở gần tâm → thu về → lại trúng con trỏ… */}
          {total > 0 &&
            wedges
              .filter((w) => w.sl.value > 0)
              .map((w) => (
                <path
                  key={`hit-${w.sl.label}`}
                  d={w.d}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(w.i)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
        </svg>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {total === 0 && (
          <li className="text-center text-xs text-slate-400">
            Chưa có số liệu
          </li>
        )}
        {total > 0 &&
          slices.map((sl, i) => (
            <li
              key={sl.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs",
                hover === i && "bg-slate-100 font-semibold",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: sl.color }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-600">
                {sl.label}
              </span>
              <b className="tabular-nums text-slate-900">{num(sl.value)}</b>
              <span className="w-10 text-right tabular-nums text-slate-500">
                {pct(sl.value, total).toLocaleString("vi-VN")}%
              </span>
            </li>
          ))}
        {total > 0 && (
          <li className="flex items-center gap-1.5 border-t border-slate-100 px-1.5 pt-1 text-xs">
            <span className="min-w-0 flex-1 text-slate-500">{centerLabel}</span>
            <b className="tabular-nums text-slate-900">{num(total)}</b>
            <span className="w-10" />
          </li>
        )}
      </ul>
    </div>
  );
}

/** Cột theo 12 tháng (1 hoặc 2 chuỗi cạnh nhau), tháng đang lọc được tô nền. */
function MonthBars({
  series,
  highlight,
  format = num,
  tooltipFormat,
  extra,
}: {
  series: { key: string; color: string; values: number[] }[];
  highlight: number;
  format?: (n: number) => string;
  tooltipFormat?: (n: number) => string;
  extra?: (i: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Điện thoại: khung vẽ hẹp hơn để biểu đồ vừa màn hình mà chữ trục vẫn đọc được.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const W = narrow ? 360 : 640;
  const H = 240;
  const L = 44;
  const B = 24;
  const T = 10;
  const plotW = W - L - 8;
  const plotH = H - B - T;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const slot = plotW / 12;
  const barW = Math.min(
    series.length === 1 ? 26 : 16,
    (slot - 10) / series.length,
  );
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const fmtTip = tooltipFormat ?? format;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={series.map((s) => s.key).join(", ")}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={L}
              x2={W - 8}
              y1={y(t)}
              y2={y(t)}
              stroke="#e2e8f0"
              strokeDasharray={t === 0 ? undefined : "3 4"}
            />
            <text
              x={L - 6}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#94a3b8"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {Array.from({ length: 12 }, (_, i) => {
          const x0 = L + i * slot;
          const groupW = barW * series.length + 3 * (series.length - 1);
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={x0 + 2}
                y={T}
                width={slot - 4}
                height={plotH}
                rx="6"
                fill={
                  hover === i
                    ? "#f1f5f9"
                    : highlight === i + 1
                      ? "#eff6ff"
                      : "transparent"
                }
              />
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const h = Math.max(0, T + plotH - y(v));
                const bx = x0 + (slot - groupW) / 2 + si * (barW + 3);
                return (
                  <path
                    key={s.key}
                    d={roundedTop(bx, T + plotH - h, barW, h, Math.min(4, h))}
                    fill={s.color}
                    opacity={
                      highlight && highlight !== i + 1 && hover !== i ? 0.55 : 1
                    }
                  />
                );
              })}
              <text
                x={x0 + slot / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize="11"
                fill={highlight === i + 1 ? "#1d4ed8" : "#64748b"}
                fontWeight={highlight === i + 1 ? 700 : 400}
              >
                T{i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${((L + hover * slot + slot / 2) / W) * 100}%`,
            transform: hover > 7 ? "translateX(-105%)" : "translateX(5%)",
          }}
        >
          <p className="mb-1 font-semibold text-slate-900">Tháng {hover + 1}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 text-slate-600">
              <span
                className="size-2 rounded-sm"
                style={{ background: s.color }}
              />
              {s.key}:{" "}
              <b className="ml-auto pl-2 tabular-nums text-slate-900">
                {fmtTip(s.values[hover] ?? 0)}
              </b>
            </p>
          ))}
          {extra && extra(hover) && (
            <p className="mt-1 border-t border-slate-100 pt-1 text-slate-500">
              {extra(hover)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function roundedTop(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  if (h <= 0) return "";
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Thanh tiến độ chăm sóc của tháng — cùng API với khối Tiến độ chăm sóc ở tab Chi tiết. */
function CareProgress({ year, month }: { year: number; month: number }) {
  const [data, setData] = useState<CareProgressResult | null>(null);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  useEffect(() => {
    let alive = true;
    clientApi<CareProgressResult>(`/care-progress?month=${monthKey}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [monthKey]);

  // Theo nhóm: tiến độ chăm sóc kho data của từng nhóm.
  const teams = useMemo(
    () =>
      (data?.target.by_team ?? [])
        .filter((t) => t.eligible > 0)
        .sort((x, y) => x.team_name.localeCompare(y.team_name, "vi", { numeric: true })),
    [data],
  );

  const m = data?.totals.monthly;
  const target = data?.target;
  return (
    <Card className="p-4">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        Tiến độ chăm sóc · Tháng {month}/{year}
      </h3>
      {/* 2 cột: trái toàn công ty, phải theo nhóm — mọi thanh cùng chiều cao nên các hàng ngang nhau. */}
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">Toàn công ty</p>
          <BigProgress
            label="Tiến độ chăm sóc kho data"
            done={target?.cared ?? 0}
            total={target?.eligible ?? 0}
            color={C.green}
          />
          <BigProgress
            label="Tiến độ chăm sóc theo data đã giao"
            done={m?.processed ?? 0}
            total={m?.assigned ?? 0}
            color={C.blue}
          />
        </div>
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">Theo nhóm · tiến độ chăm sóc kho data</p>
          {teams.length === 0 && (
            <p className="text-xs text-slate-400">Chưa có data trong kho chăm sóc</p>
          )}
          {teams.map((t, i) => (
            <BigProgress
              key={t.team_id}
              label={t.team_name}
              done={t.cared}
              total={t.eligible}
              color={TEAM_COLORS[i % TEAM_COLORS.length]}
            />
          ))}
        </div>
      </div>
      {m && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Tổng lượt chăm sóc trong tháng:{" "}
          <b className="text-slate-800">{num(m.care_turns)}</b> · Còn chưa xử
          lý: <b className="text-slate-800">{num(m.pending)}</b>
        </p>
      )}
    </Card>
  );
}

function BigProgress({
  label,
  done,
  total,
  color,
}: {
  label: string;
  done: number;
  total: number;
  color: string;
}) {
  const rate = pct(done, total);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-xs text-slate-600">{label}</span>
        <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
          <b className="text-lg text-slate-900 tabular-nums">
            {rate.toLocaleString("vi-VN")}%
          </b>{" "}
          · {num(done)}/{num(total)}
        </span>
      </div>
      <div className="h-3.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(rate, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

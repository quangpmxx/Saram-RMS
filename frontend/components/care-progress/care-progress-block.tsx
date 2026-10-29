"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, HeartHandshake, Inbox } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { AccountRole, AppRealtimeEvent } from "@/lib/types";
import { useAppRealtime, useRealtimeReconnect } from "@/lib/realtime";
import {
  formatCareDateTime,
  type CareDailyMetrics,
  type CareMonthlyMetrics,
  type CareProgressResult,
  type CareProgressRow,
} from "@/lib/care-warehouse";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

/** Vai trò xem được Tiến độ chăm sóc — khớp CareWarehouseService.progress() ở backend. */
export const CARE_PROGRESS_ROLES: AccountRole[] = ["admin", "manager", "leader", "sale"];

/** Gộp nhiều tín hiệu "dashboard invalidate" liên tiếp thành 1 lần tải lại. */
const REALTIME_DEBOUNCE_MS = 800;

function vnToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toLocaleString("vi-VN")}%`;
}

function monthLabel(month: string): string {
  const [year, mm] = month.split("-");
  return `${mm}/${year}`;
}

function dateLabel(date: string): string {
  const [year, mm, dd] = date.split("-");
  return `${dd}/${mm}/${year}`;
}

/** Sale còn data chưa xử lý (trong ngày hoặc tồn cũ) — khớp bộ lọc status=pending ở backend. */
function hasPending(daily: CareDailyMetrics): boolean {
  return daily.today.pending + daily.backlog.remaining > 0;
}

function Metric({
  label,
  value,
  tone = "text-slate-900",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className={cn("text-xl font-bold tabular-nums", tone)}>
        {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
      </p>
      <p className="truncate text-[11px] text-slate-500" title={hint}>
        {label}
      </p>
    </div>
  );
}

function Group({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className={cn("text-xs font-semibold text-slate-800", !subtitle && "mb-2")}>{title}</p>
      {subtitle && <p className="mb-2 text-[10px] text-slate-400">{subtitle}</p>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">{children}</div>
    </div>
  );
}

type ViewMode = "day" | "month";

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all duration-200"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

/**
 * Yêu cầu người dùng (2026-10-29): mặc định chỉ hiện số liệu + thanh tiến
 * trình theo NGÀY; muốn xem tháng thì chọn "Theo tháng".
 */
function DaySummary({ daily, date, showNotes }: { daily: CareDailyMetrics; date: string; showNotes: boolean }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Group
        title={`Trong ngày ${dateLabel(date)}`}
        subtitle={showNotes ? "Data được giao trong ngày — mỗi data đếm 1 lần" : undefined}
      >
        <Metric label="Được giao" value={daily.today.assigned} />
        <Metric label="Đã xử lý" value={daily.today.processed} tone="text-emerald-700" />
        <Metric label="Chưa xử lý" value={daily.today.pending} tone="text-red-700" />
        <Metric
          label="Tỷ lệ hoàn thành"
          value={formatRate(daily.completion_rate)}
          tone="text-brand-700"
          hint="Đã xử lý ÷ Được giao trong ngày"
        />
        <div className="col-span-2 sm:col-span-4">
          <ProgressBar percent={daily.completion_rate ?? 0} />
          <p className="mt-1 text-[11px] text-slate-500">
            {daily.today.assigned === 0
              ? "Chưa có data nào được giao trong ngày"
              : `Còn ${daily.today.pending.toLocaleString("vi-VN")} data giao trong ngày chưa xử lý`}
          </p>
        </div>
      </Group>
      <Group
        title="Tồn cũ"
        subtitle={
          showNotes ? "Giao từ các ngày trước trong tháng, chưa xử lý — tính riêng, không vào tỷ lệ ngày" : undefined
        }
      >
        <Metric label="Tồn đầu ngày" value={daily.backlog.start} />
        <Metric label="Đã xử lý hôm nay" value={daily.backlog.processed} tone="text-emerald-700" />
        <Metric label="Còn tồn" value={daily.backlog.remaining} tone="text-amber-700" />
        <Metric
          label="Lượt CS trong ngày"
          value={daily.care_turns}
          hint="Số ghi chú trong ngày, cả 2 nhóm Trong ngày và Tồn cũ (1 data có thể nhiều lượt)"
        />
      </Group>
    </div>
  );
}

function MonthSummary({
  monthly,
  target,
  month,
  isSale,
}: {
  monthly: CareMonthlyMetrics;
  target: CareProgressResult["target"];
  month: string;
  isSale: boolean;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Group title={`Tháng ${monthLabel(month)}`} subtitle="Data được giao trong tháng">
        <Metric label="Được giao" value={monthly.assigned} />
        <Metric label="Đã chăm sóc" value={monthly.processed} tone="text-emerald-700" />
        <Metric
          label="Chưa chăm sóc"
          value={monthly.pending}
          tone="text-red-700"
          hint="Đang giao cho Sale nhưng Sale chưa ghi chú lần nào trong tháng"
        />
        <Metric label="Lượt chăm sóc tháng" value={monthly.care_turns} />
      </Group>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-800">Mục tiêu tháng {monthLabel(month)}</p>
        <p className="mb-2 text-[10px] text-slate-400">
          Mỗi data trong Kho{isSale ? " của nhóm" : ""} được chăm sóc ít nhất 1 lần trong tháng
        </p>
        <div className="flex items-end justify-between gap-2">
          <p className="text-xl font-bold text-slate-900 tabular-nums">
            {target.cared.toLocaleString("vi-VN")}
            <span className="text-sm font-medium text-slate-400">
              {" "}
              / {target.eligible.toLocaleString("vi-VN")} data
            </span>
          </p>
          <p className="text-xl font-bold text-brand-700 tabular-nums">{formatRate(target.rate)}</p>
        </div>
        <ProgressBar percent={target.rate ?? 0} />
        <p className="mt-1 text-[11px] text-slate-500">
          Còn {target.not_cared.toLocaleString("vi-VN")} data chưa được chăm sóc
        </p>
      </div>
    </div>
  );
}

function SaleTable({
  rows,
  totals,
  mode,
}: {
  rows: CareProgressRow[];
  totals: CareProgressResult["totals"];
  mode: ViewMode;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-6 text-sm text-slate-400">
        <Inbox className="h-5 w-5" strokeWidth={1.75} />
        Không có Sale nào khớp bộ lọc
      </div>
    );
  }
  const th = "border-b border-slate-200 px-2 py-2 font-semibold whitespace-nowrap";
  const td = "px-2 py-2 tabular-nums";
  const isDay = mode === "day";
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-brand-50/95 text-[10px] tracking-wider text-brand-900 uppercase backdrop-blur">
          <tr>
            <th className={th}>Sale</th>
            <th className={th}>Nhóm</th>
            {isDay ? (
              <>
                <th className={cn(th, "text-right")}>Giao trong ngày</th>
                <th className={cn(th, "text-right")}>Đã chăm sóc</th>
                <th className={cn(th, "text-right")}>Chưa chăm sóc</th>
                <th className={cn(th, "text-right")}>Tỷ lệ ngày</th>
                <th className={cn(th, "text-right")} title="Còn tồn / tồn đầu ngày">
                  Tồn cũ
                </th>
                <th className={cn(th, "text-right")}>Lượt CS ngày</th>
              </>
            ) : (
              <>
                <th className={cn(th, "text-right")}>Giao trong tháng</th>
                <th className={cn(th, "text-right")}>Đã chăm sóc</th>
                <th className={cn(th, "text-right")}>Chưa CS trong tháng</th>
                <th className={cn(th, "text-right")}>Lượt CS tháng</th>
                <th className={th}>Chăm sóc gần nhất</th>
              </>
            )}
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.account.id} className="hover:bg-brand-50/40">
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    fullName={row.account.name}
                    avatarUrl={row.account.avatar_url}
                    className="h-6 w-6 shrink-0 text-[10px]"
                  />
                  <span className="font-medium text-slate-800">{row.account.name}</span>
                </div>
              </td>
              <td className="px-2 py-2 text-slate-500">{row.team?.name ?? "—"}</td>
              {isDay ? (
                <>
                  <td className={cn(td, "text-right")}>{row.daily.today.assigned}</td>
                  <td className={cn(td, "text-right text-emerald-700")}>{row.daily.today.processed}</td>
                  <td className={cn(td, "text-right", row.daily.today.pending > 0 && "font-semibold text-red-700")}>
                    {row.daily.today.pending}
                  </td>
                  <td className={cn(td, "text-right font-medium text-brand-700")}>
                    {formatRate(row.daily.completion_rate)}
                  </td>
                  <td className={cn(td, "text-right", row.daily.backlog.remaining > 0 && "text-amber-700")}>
                    {row.daily.backlog.remaining} / {row.daily.backlog.start}
                  </td>
                  <td className={cn(td, "text-right")}>{row.daily.care_turns}</td>
                </>
              ) : (
                <>
                  <td className={cn(td, "text-right")}>{row.monthly.assigned}</td>
                  <td className={cn(td, "text-right text-emerald-700")}>{row.monthly.processed}</td>
                  <td className={cn(td, "text-right", row.monthly.pending > 0 && "text-red-700")}>
                    {row.monthly.pending}
                  </td>
                  <td className={cn(td, "text-right")}>{row.monthly.care_turns}</td>
                  <td className="px-2 py-2 text-slate-500">{formatCareDateTime(row.monthly.last_care_at)}</td>
                </>
              )}
              <td className="px-2 py-2">
                <Link
                  href={`/candidates?view=care&care_assignee=${row.account.id}`}
                  className="inline-flex items-center gap-0.5 text-brand-700 hover:underline"
                  title="Mở Kho chăm sóc, lọc theo Sale này"
                >
                  Xem
                  <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-slate-50 font-semibold text-slate-800">
          <tr title="Dòng tổng đếm theo data khác nhau — 1 data giao lại cho Sale khác chỉ tính 1 lần">
            <td className="px-2 py-2" colSpan={2}>
              Tổng (data khác nhau)
            </td>
            {isDay ? (
              <>
                <td className={cn(td, "text-right")}>{totals.daily.today.assigned}</td>
                <td className={cn(td, "text-right")}>{totals.daily.today.processed}</td>
                <td className={cn(td, "text-right")}>{totals.daily.today.pending}</td>
                <td className={cn(td, "text-right")}>{formatRate(totals.daily.completion_rate)}</td>
                <td className={cn(td, "text-right")}>
                  {totals.daily.backlog.remaining} / {totals.daily.backlog.start}
                </td>
                <td className={cn(td, "text-right")}>{totals.daily.care_turns}</td>
              </>
            ) : (
              <>
                <td className={cn(td, "text-right")}>{totals.monthly.assigned}</td>
                <td className={cn(td, "text-right")}>{totals.monthly.processed}</td>
                <td className={cn(td, "text-right")}>{totals.monthly.pending}</td>
                <td className={cn(td, "text-right")}>{totals.monthly.care_turns}</td>
                <td className="px-2 py-2">{formatCareDateTime(totals.monthly.last_care_at)}</td>
              </>
            )}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Kho chăm sóc (2026-10-28) — khối "Tiến độ chăm sóc". Dùng CHUNG cho
 * Dashboard (Phần 4) và tab Tiến độ chăm sóc trong Báo cáo (Phần 5), cùng 1
 * API GET /care-progress nên 2 nơi luôn ra cùng con số. Sale chỉ thấy số
 * của chính mình (backend ép phạm vi); Leader/Quản lý/Admin thấy thêm bảng
 * theo từng Sale.
 */
export function CareProgressBlock({
  currentUserRole,
  teamId = "",
  accountId = "",
  status = "",
  showNotes = true,
}: {
  currentUserRole: AccountRole;
  /** Bộ lọc nhóm/nhân viên lấy từ trang chứa (Dashboard/Báo cáo). */
  teamId?: string;
  accountId?: string;
  status?: "" | "pending" | "done";
  /** false = ẩn các dòng chú thích giải thích (Dashboard — yêu cầu người dùng 2026-10-29). */
  showNotes?: boolean;
}) {
  const isSale = currentUserRole === "sale";
  const [mode, setMode] = useState<ViewMode>("day");
  const [date, setDate] = useState(vnToday);
  const [month, setMonth] = useState(() => vnToday().slice(0, 7));
  const [data, setData] = useState<CareProgressResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = new URLSearchParams({ date, month });
  if (teamId) query.set("team_id", teamId);
  if (accountId) query.set("account_id", accountId);
  if (status) query.set("status", status);
  const queryKey = query.toString();

  const load = useCallback(
    (key: string) =>
      clientApi<CareProgressResult>(`/care-progress?${key}`)
        .then((result) => {
          setData(result);
          setError(null);
        })
        .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Không tải được tiến độ chăm sóc")),
    [],
  );

  useEffect(() => {
    void load(queryKey);
  }, [load, queryKey]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void load(queryKey), REALTIME_DEBOUNCE_MS);
  }, [load, queryKey]);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  // Giao/thu hồi/dừng chăm sóc/ghi chú đều phát "dashboard invalidate" (backend).
  useAppRealtime((event: AppRealtimeEvent) => {
    if (event.module === "dashboard" && event.action === "invalidate") scheduleReload();
  });
  useRealtimeReconnect(scheduleReload);

  const ownRow = isSale ? data?.rows[0] : undefined;
  const pendingCount = data ? data.rows.filter((r) => hasPending(r.daily)).length : 0;

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <HeartHandshake className="h-4 w-4 text-brand-600" strokeWidth={2} />
            Tiến độ chăm sóc
          </h2>
          {showNotes && (
            <p className="text-xs text-slate-500">
              {isSale
                ? "Data Kho chăm sóc được giao cho bạn. Chỉ ghi chú của chính bạn mới tính là đã xử lý."
                : `Theo từng Sale. Đã xử lý = Sale được giao đã ghi chú.${
                    data && data.rows.length > 0 ? ` ${pendingCount}/${data.rows.length} Sale còn data chưa xử lý.` : ""
                  }`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium" role="tablist" aria-label="Xem theo">
            {(
              [
                ["day", "Theo ngày"],
                ["month", "Theo tháng"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  mode === key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "day" ? (
            <Field label="Ngày" uiSize="sm">
              <Input
                uiSize="sm"
                type="date"
                value={date}
                max={vnToday()}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDate(e.target.value);
                  setMonth(e.target.value.slice(0, 7));
                }}
              />
            </Field>
          ) : (
            <Field label="Tháng" uiSize="sm">
              <Input
                uiSize="sm"
                type="month"
                value={month}
                max={vnToday().slice(0, 7)}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </Field>
          )}
          <Link
            href={accountId ? `/candidates?view=care&care_assignee=${accountId}` : "/candidates?view=care"}
            className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
          >
            Mở Kho chăm sóc
            <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {!data ? (
        !error && <p className="py-6 text-center text-sm text-slate-400">Đang tải…</p>
      ) : isSale ? (
        ownRow ? (
          mode === "day" ? (
            <DaySummary daily={ownRow.daily} date={data.date} showNotes={showNotes} />
          ) : (
            <MonthSummary monthly={ownRow.monthly} target={data.target} month={data.month} isSale />
          )
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
        )
      ) : (
        <div className="space-y-3">
          {mode === "day" ? (
            <DaySummary daily={data.totals.daily} date={data.date} showNotes={showNotes} />
          ) : (
            <MonthSummary monthly={data.totals.monthly} target={data.target} month={data.month} isSale={false} />
          )}
          <SaleTable rows={data.rows} totals={data.totals} mode={mode} />
        </div>
      )}
    </Card>
  );
}

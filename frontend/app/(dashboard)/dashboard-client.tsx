"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Medal,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type {
  AccountRole,
  AppRealtimeEvent,
  DashboardSummary,
  KpiBreakdown,
  LeadSource,
  SalePerformance,
  Team,
  TeamSummary,
} from "@/lib/types";
import { useAppRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { computeDateRange, type DatePreset, type DateRangeValue } from "@/lib/date-range";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";

/**
 * Dự án phụ — nâng cấp toàn diện (riêng giao diện Dashboard, ngoài phạm vi
 * Design Freeze docs/09-13): thiết kế lại toàn bộ trang theo yêu cầu trực
 * tiếp người dùng (2026-07-14) — 7 thẻ KPI + hiệu suất toàn công ty/theo
 * nhóm/theo nhân viên, ưu tiên xem nhanh trong 5 giây. KHÔNG đổi nghiệp vụ/
 * DB/API cũ — chỉ CỘNG THÊM field `kpi`/`kpi_previous` (xem
 * dashboard.service.ts, computeKpiBreakdown() — tách riêng khỏi
 * computeFunnel() nên không ảnh hưởng trang Báo cáo).
 */
const PENDING_VIEW_ROLES: AccountRole[] = ["admin", "manager", "leader", "mkt", "sale"];

type KpiKey = keyof Pick<
  KpiBreakdown,
  "new_leads" | "interview_scheduled" | "attended" | "no_show" | "passed" | "failed" | "employed"
>;

const KPI_CARDS: Array<{
  key: KpiKey;
  label: string;
  icon: typeof Sparkles;
  tint: string;
  iconColor: string;
}> = [
  { key: "new_leads", label: "Data mới", icon: Sparkles, tint: "bg-brand-50", iconColor: "text-brand-600" },
  { key: "interview_scheduled", label: "Hẹn PV", icon: CalendarClock, tint: "bg-brand-50", iconColor: "text-brand-600" },
  { key: "attended", label: "Đến PV", icon: UserCheck, tint: "bg-emerald-50", iconColor: "text-emerald-600" },
  { key: "no_show", label: "Bùng PV", icon: UserX, tint: "bg-red-50", iconColor: "text-red-600" },
  { key: "passed", label: "Đỗ PV", icon: CheckCircle2, tint: "bg-emerald-50", iconColor: "text-emerald-700" },
  { key: "failed", label: "Trượt PV", icon: XCircle, tint: "bg-red-50", iconColor: "text-red-700" },
  { key: "employed", label: "Đi làm", icon: Briefcase, tint: "bg-accent-50", iconColor: "text-accent-600" },
];

/** null = không đủ dữ liệu kỳ trước để so sánh (chưa chọn khoảng ngày, hoặc kỳ trước = 0 mà kỳ này cũng = 0). */
function percentChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  if (previous === 0) return current === 0 ? null : Infinity;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Nhãn "so với ..." khớp đúng độ dài khoảng thời gian mà getPreviousRange()
 * ở backend (dashboard.service.ts) thực sự dùng để tính % (khoảng liền
 * trước, cùng độ dài với bộ lọc đang chọn) — yêu cầu trực tiếp người dùng
 * (2026-07-17): ghi chú ngay dưới mỗi badge %, vd "Hẹn PV giảm 25,8%" xuống
 * dòng "so với tháng trước".
 */
const PREVIOUS_PERIOD_LABEL: Partial<Record<DatePreset, string>> = {
  today: "so với hôm qua",
  yesterday: "so với hôm kia",
  today_yesterday: "so với 2 ngày trước đó",
  "7d": "so với 7 ngày trước đó",
  "14d": "so với 14 ngày trước đó",
  "28d": "so với 28 ngày trước đó",
  "30d": "so với 30 ngày trước đó",
  this_week: "so với tuần trước",
  last_week: "so với tuần trước đó",
  this_month: "so với tháng trước",
  last_month: "so với tháng trước đó",
};

function previousPeriodLabel(preset: DatePreset): string {
  return PREVIOUS_PERIOD_LABEL[preset] ?? "so với kỳ liền trước";
}

function ChangeBadge({ value, previousLabel }: { value: number | null; previousLabel: string }) {
  if (value === null || value === 0) return null;

  const badge =
    value === Infinity ? (
      <Badge variant="accent" className="gap-0.5">
        <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
        Mới
      </Badge>
    ) : (
      <Badge variant={value > 0 ? "success" : "danger"} className="gap-0.5">
        {value > 0 ? <TrendingUp className="h-3 w-3" strokeWidth={2.5} /> : <TrendingDown className="h-3 w-3" strokeWidth={2.5} />}
        {value > 0 ? "+" : ""}
        {value}%
      </Badge>
    );

  return (
    <div className="flex flex-col items-center gap-1">
      {badge}
      <span className="text-[10px] text-slate-400">{previousLabel}</span>
    </div>
  );
}

function ProgressBar({ percent, colorClass = "bg-accent-500" }: { percent: number; colorClass?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${colorClass} transition-all duration-200`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

type Rank = 1 | 2 | 3;

const RANK_BADGE_CLASS: Record<Rank, string> = {
  1: "bg-amber-100 text-amber-600",
  2: "bg-slate-100 text-slate-500",
  3: "bg-orange-100 text-orange-700",
};

/**
 * Dự án phụ — nâng cấp toàn diện (riêng giao diện Dashboard, ngoài phạm vi
 * Design Freeze docs/09-13): 1 dòng trong bảng "Top 3" — yêu cầu trực tiếp
 * người dùng (2026-07-14). Hạng 1 icon Trophy + nổi bật hơn (nền vàng nhạt,
 * avatar to hơn), hạng 2/3 icon Medal màu bạc/đồng.
 */
function RankingRow({
  rank,
  fullName,
  avatarUrl,
  teamName,
  primaryValue,
  secondaryPercent,
  secondaryLabel,
}: {
  rank: Rank;
  fullName: string;
  avatarUrl: string | null;
  teamName: string;
  primaryValue: number;
  secondaryPercent: number;
  secondaryLabel: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[64px] items-center gap-3 rounded-xl px-2 transition-colors hover:bg-slate-50",
        rank === 1 && "bg-amber-50/50",
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", RANK_BADGE_CLASS[rank])}>
        {rank === 1 ? <Trophy className="h-4 w-4" strokeWidth={2.2} /> : <Medal className="h-4 w-4" strokeWidth={2.2} />}
      </div>
      <Avatar fullName={fullName} avatarUrl={avatarUrl} className={rank === 1 ? "h-9 w-9 text-sm" : "h-8 w-8 text-xs"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{fullName}</p>
        <p className="truncate text-[11px] text-slate-400">{teamName || "—"}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-bold text-slate-900">{primaryValue.toLocaleString("vi-VN")}</p>
        <p className="text-[11px] text-slate-400">
          {secondaryPercent}% {secondaryLabel}
        </p>
      </div>
    </div>
  );
}

function RankingEmptyState() {
  return <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu xếp hạng trong khoảng thời gian này.</p>;
}

type EmployeeSort = "new_leads" | "employed" | "performance";
type TeamSort = "new_leads" | "performance";

export function DashboardClient({
  currentUserFullName,
  currentUserRole,
  canViewPerformance,
  canViewByTeam,
  canFilterByTeam,
  teams,
  sources,
  initialSummary,
  initialPerformance,
  initialByTeam,
}: {
  currentUserFullName: string;
  currentUserRole: AccountRole;
  canViewPerformance: boolean;
  canViewByTeam: boolean;
  canFilterByTeam: boolean;
  teams: Team[];
  sources: LeadSource[];
  initialSummary: DashboardSummary;
  initialPerformance: SalePerformance[];
  initialByTeam: TeamSummary[];
}) {
  useSetPageTitle("Dashboard", `Xin chào, ${currentUserFullName} — tổng quan số liệu hệ thống.`);

  const [summary, setSummary] = useState(initialSummary);
  const [performance, setPerformance] = useState(initialPerformance);
  const [byTeam, setByTeam] = useState(initialByTeam);
  /** Danh sách CỐ ĐỊNH cho dropdown "Nhân viên" — lấy 1 lần từ initialPerformance (chưa lọc), không đổi theo kết quả performance đã lọc sau đó (nếu không sẽ chỉ còn 1 lựa chọn sau khi lọc theo 1 nhân viên). */
  const [employeeOptions] = useState(initialPerformance);

  const [dateRange, setDateRange] = useState<DateRangeValue>(() => ({
    preset: "this_month",
    ...computeDateRange("this_month"),
  }));
  const [teamId, setTeamId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [quickView, setQuickView] = useState<SalePerformance | null>(null);
  const [employeeSort, setEmployeeSort] = useState<EmployeeSort>("employed");
  const [teamSort, setTeamSort] = useState<TeamSort>("new_leads");

  const canViewPending = PENDING_VIEW_ROLES.includes(currentUserRole);

  /**
   * Nhận thẳng giá trị bộ lọc vừa đổi qua `overrides` (không đọc lại state
   * cha) — setState bất đồng bộ, đọc lại state ngay sau khi gọi setter vẫn
   * là giá trị CŨ (closure của lần render hiện tại), nên mỗi handler onChange
   * dưới đây truyền thẳng giá trị mới vào refresh() cùng lúc với setState.
   */
  function buildQuery(overrides?: {
    dateRange?: DateRangeValue;
    teamId?: string;
    accountId?: string;
    sourceId?: string;
  }): URLSearchParams {
    const effectiveDateRange = overrides?.dateRange ?? dateRange;
    const effectiveTeamId = overrides?.teamId ?? teamId;
    const effectiveAccountId = overrides?.accountId ?? accountId;
    const effectiveSourceId = overrides?.sourceId ?? sourceId;

    const query = new URLSearchParams();
    if (effectiveDateRange.from) query.set("date_from", new Date(effectiveDateRange.from).toISOString());
    if (effectiveDateRange.to) query.set("date_to", new Date(`${effectiveDateRange.to}T23:59:59.999`).toISOString());
    if (canFilterByTeam && effectiveTeamId) query.set("team_id", effectiveTeamId);
    if (effectiveAccountId) query.set("account_id", effectiveAccountId);
    if (effectiveSourceId) query.set("source_id", effectiveSourceId);
    return query;
  }

  async function refresh(overrides?: {
    dateRange?: DateRangeValue;
    teamId?: string;
    accountId?: string;
    sourceId?: string;
  }) {
    const query = buildQuery(overrides);
    setLoading(true);
    try {
      const [nextSummary, nextPerformance, nextByTeam] = await Promise.all([
        clientApi<DashboardSummary>(`/dashboard/summary?${query.toString()}`),
        canViewPerformance
          ? clientApi<SalePerformance[]>(`/dashboard/performance?${query.toString()}`)
          : Promise.resolve<SalePerformance[]>([]),
        canViewByTeam ? clientApi<TeamSummary[]>(`/dashboard/by-team?${query.toString()}`) : Promise.resolve<TeamSummary[]>([]),
      ]);
      setSummary(nextSummary);
      setPerformance(nextPerformance);
      setByTeam(nextByTeam);
    } catch {
      toast.error("Không tải được số liệu, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Yêu cầu người dùng (Mục 4, mở rộng realtime — Dashboard) — refetch NỀN,
   * giữ nguyên bộ lọc hiện tại (buildQuery() không truyền overrides => dùng
   * đúng state đang chọn), KHÔNG bật `loading` (tránh nhấp nháy/spin icon
   * "Làm mới" — khác hẳn refresh() gốc dùng cho hành động chủ động của
   * người dùng).
   */
  async function silentRefresh() {
    try {
      const query = buildQuery();
      const [nextSummary, nextPerformance, nextByTeam] = await Promise.all([
        clientApi<DashboardSummary>(`/dashboard/summary?${query.toString()}`),
        canViewPerformance
          ? clientApi<SalePerformance[]>(`/dashboard/performance?${query.toString()}`)
          : Promise.resolve<SalePerformance[]>([]),
        canViewByTeam ? clientApi<TeamSummary[]>(`/dashboard/by-team?${query.toString()}`) : Promise.resolve<TeamSummary[]>([]),
      ]);
      setSummary(nextSummary);
      setPerformance(nextPerformance);
      setByTeam(nextByTeam);
    } catch {
      // Bỏ qua lỗi tải nền — dữ liệu cũ vẫn hiển thị, sự kiện invalidate kế tiếp sẽ tự sửa.
    }
  }

  /**
   * Mục 4: "dùng debounce/batch khoảng 500-1000ms để nhiều event liên tiếp
   * không gọi API quá nhiều" — nhiều sự kiện dashboard.invalidate dồn dập
   * (vd bulk assign nhiều lead cùng lúc) chỉ gộp thành ĐÚNG 1 lượt refetch.
   */
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleInvalidateRefresh() {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      invalidateTimerRef.current = null;
      void silentRefresh();
    }, 800);
  }
  useEffect(() => {
    return () => {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    };
  }, []);

  function handleAppRealtimeEvent(event: AppRealtimeEvent) {
    if (event.module !== "dashboard" || event.action !== "invalidate") return;
    scheduleInvalidateRefresh();
  }

  useAppRealtime(handleAppRealtimeEvent);
  /** Mục 8: sau khi mất mạng rồi kết nối lại, refetch 1 lần (không cần debounce — chỉ 1 lần duy nhất). */
  useRealtimeReconnect(() => void silentRefresh());

  const dateRangeQuery = buildQuery().toString();

  const sortedTeams = useMemo(() => {
    const copy = [...byTeam];
    copy.sort((a, b) =>
      teamSort === "performance"
        ? (b.kpi.performance_rate ?? 0) - (a.kpi.performance_rate ?? 0)
        : b.kpi.new_leads - a.kpi.new_leads,
    );
    return copy;
  }, [byTeam, teamSort]);

  const sortedPerformance = useMemo(() => {
    const copy = [...performance];
    copy.sort((a, b) => {
      if (employeeSort === "performance") return (b.kpi.performance_rate ?? 0) - (a.kpi.performance_rate ?? 0);
      if (employeeSort === "employed") return (b.kpi.employed ?? 0) - (a.kpi.employed ?? 0);
      return b.kpi.new_leads - a.kpi.new_leads;
    });
    return copy;
  }, [performance, employeeSort]);

  const teamNameById = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);

  /**
   * Dự án phụ — nâng cấp toàn diện (riêng giao diện Dashboard, ngoài phạm vi
   * Design Freeze docs/09-13): 2 bảng "Top 3" — yêu cầu trực tiếp người dùng
   * (2026-07-14). Tính THẲNG từ `performance` (đã áp dụng đúng bộ lọc hiện
   * tại qua refresh() — không gọi API riêng) nên tự động đồng bộ theo mọi
   * bộ lọc Dashboard, không cần thêm state/fetch nào. Loại bỏ người có 0 —
   * xếp hạng "0 Hẹn PV"/"0 Đỗ PV" không có ý nghĩa.
   */
  const topScheduled = useMemo(() => {
    return performance
      .filter((row) => row.kpi.interview_scheduled > 0)
      .map((row) => ({
        row,
        ratio: row.kpi.new_leads > 0 ? Math.round((row.kpi.interview_scheduled / row.kpi.new_leads) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.row.kpi.interview_scheduled - a.row.kpi.interview_scheduled || b.ratio - a.ratio)
      .slice(0, 3);
  }, [performance]);

  const topPassed = useMemo(() => {
    return performance
      .filter((row) => row.kpi.passed > 0)
      .map((row) => ({
        row,
        ratio: row.kpi.attended > 0 ? Math.round((row.kpi.passed / row.kpi.attended) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.row.kpi.passed - a.row.kpi.passed || b.ratio - a.ratio)
      .slice(0, 3);
  }, [performance]);

  return (
    <div className="-mt-3 mx-auto max-w-7xl space-y-5">
      {/* Bộ lọc — Mục 5, yêu cầu trực tiếp người dùng: Khoảng thời gian/Nhóm/Nhân viên/Nguồn, cập nhật realtime. Thu hẹp cả cụm lọc (2026-07-14, yêu cầu trực tiếp người dùng). */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <Field label="Khoảng thời gian" uiSize="sm" className="w-36">
            <DateRangePicker
              value={dateRange}
              onChange={(next) => {
                setDateRange(next);
                void refresh({ dateRange: next });
              }}
            />
          </Field>
          {canFilterByTeam && (
            <Field label="Nhóm" uiSize="sm" className="w-36">
              <Select
                uiSize="sm"
                value={teamId}
                onChange={(event) => {
                  const next = event.target.value;
                  setTeamId(next);
                  void refresh({ teamId: next });
                }}
              >
                <option value="">Tất cả nhóm</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {canViewPerformance && (
            <Field label="Nhân viên" uiSize="sm" className="w-36">
              <Select
                uiSize="sm"
                value={accountId}
                onChange={(event) => {
                  const next = event.target.value;
                  setAccountId(next);
                  void refresh({ accountId: next });
                }}
              >
                <option value="">Tất cả nhân viên</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.account_id} value={employee.account_id}>
                    {employee.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Nguồn" uiSize="sm" className="w-32">
            <Select
              uiSize="sm"
              value={sourceId}
              onChange={(event) => {
                const next = event.target.value;
                setSourceId(next);
                void refresh({ sourceId: next });
              }}
            >
              <option value="">Tất cả nguồn</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="ml-auto flex items-center gap-3">
            {canViewPending && (
              <Link
                href="/candidates?view=pending"
                className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
              >
                <Users className="h-3.5 w-3.5" strokeWidth={2} />
                Chờ phân chia: {summary.pending_count.toLocaleString("vi-VN")}
                <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
              </Link>
            )}
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2} />
              Làm mới
            </Button>
          </div>
        </div>
      </Card>

      {/* 1. KPI toàn công ty — Mục 1, yêu cầu trực tiếp người dùng: 7 thẻ, xem nhanh trong 5 giây. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {KPI_CARDS.map(({ key, label, icon: Icon, tint, iconColor }) => {
          const value = summary.kpi[key];
          const previous = summary.kpi_previous?.[key];
          const change = value === null ? null : percentChange(value, previous ?? undefined);
          return (
            <Card
              key={key}
              className="flex min-h-[112px] flex-col justify-between gap-2 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
                  <Icon className={`h-4.5 w-4.5 ${iconColor}`} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-3xl font-bold tracking-tight text-brand-900">
                    {value === null ? "—" : value.toLocaleString("vi-VN")}
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p>
                </div>
              </div>
              <div className="flex justify-center">
                <ChangeBadge value={change} previousLabel={previousPeriodLabel(dateRange.preset)} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* 2. Hiệu suất toàn công ty — yêu cầu trực tiếp người dùng (2026-07-14): bỏ cột biểu đồ thanh ngang, chỉ giữ 4 ô tỷ lệ; thu gọn card (giảm padding) để đẩy khối Top sale bên dưới lên. */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900">Hiệu suất toàn công ty</h2>
        <p className="text-xs text-slate-500">Tỷ lệ chuyển đổi qua từng bước phễu — % tính trên Data mới.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-brand-50 p-2 text-center">
            <p className="text-base font-bold text-brand-700">{summary.kpi.schedule_rate}%</p>
            <p className="text-xs text-brand-600/70">Tỷ lệ hẹn PV</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-2 text-center">
            <p className="text-base font-bold text-emerald-600">{summary.kpi.attend_rate}%</p>
            <p className="text-xs text-emerald-600/70">Tỷ lệ đến PV</p>
          </div>
          <div className="rounded-xl bg-emerald-100 p-2 text-center">
            <p className="text-base font-bold text-emerald-700">{summary.kpi.pass_rate}%</p>
            <p className="text-xs text-emerald-700/70">Tỷ lệ đỗ PV</p>
          </div>
          <div className="rounded-xl bg-accent-50 p-2 text-center">
            <p className="text-base font-bold text-accent-600">
              {summary.kpi.employed_rate === null ? "—" : `${summary.kpi.employed_rate}%`}
            </p>
            <p className="text-xs text-accent-600/70">Tỷ lệ đi làm</p>
          </div>
        </div>
      </Card>

      {/* 2b. Top 3 xếp hạng — yêu cầu trực tiếp người dùng (2026-07-14): tính thẳng từ `performance` nên tự đồng bộ theo mọi bộ lọc, không cần fetch riêng. */}
      {canViewPerformance && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" strokeWidth={2} />
              <h2 className="text-sm font-semibold text-slate-900">Top 3 nhân viên hẹn PV nhiều nhất</h2>
            </div>
            <p className="text-xs text-slate-500">Số lượng Hẹn PV cao nhất trong khoảng thời gian và bộ lọc hiện tại.</p>
            <div className="mt-3 flex flex-col gap-1">
              {topScheduled.map(({ row, ratio }, index) => (
                <RankingRow
                  key={row.account_id}
                  rank={(index + 1) as Rank}
                  fullName={row.full_name}
                  avatarUrl={row.avatar_url}
                  teamName={row.team_id ? (teamNameById.get(row.team_id) ?? "") : ""}
                  primaryValue={row.kpi.interview_scheduled}
                  secondaryPercent={ratio}
                  secondaryLabel="/ Data mới"
                />
              ))}
              {topScheduled.length === 0 && <RankingEmptyState />}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" strokeWidth={2} />
              <h2 className="text-sm font-semibold text-slate-900">Top 3 nhân viên đỗ PV cao nhất</h2>
            </div>
            <p className="text-xs text-slate-500">Số lượng Đỗ PV cao nhất trong khoảng thời gian và bộ lọc hiện tại.</p>
            <div className="mt-3 flex flex-col gap-1">
              {topPassed.map(({ row, ratio }, index) => (
                <RankingRow
                  key={row.account_id}
                  rank={(index + 1) as Rank}
                  fullName={row.full_name}
                  avatarUrl={row.avatar_url}
                  teamName={row.team_id ? (teamNameById.get(row.team_id) ?? "") : ""}
                  primaryValue={row.kpi.passed}
                  secondaryPercent={ratio}
                  secondaryLabel="/ Đến PV"
                />
              ))}
              {topPassed.length === 0 && <RankingEmptyState />}
            </div>
          </Card>
        </div>
      )}

      {/* 3. Hiệu suất theo nhóm */}
      {canViewByTeam && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Hiệu suất theo nhóm</h2>
            <Select uiSize="xs" className="w-44" value={teamSort} onChange={(event) => setTeamSort(event.target.value as TeamSort)}>
              <option value="new_leads">Nhiều Data nhất</option>
              <option value="performance">Hiệu suất cao nhất</option>
            </Select>
          </div>
          <div className="mt-3 flex flex-col divide-y divide-brand-400">
            {sortedTeams.map((team) => (
              <div key={team.team_id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="w-32 shrink-0">
                  <p className="text-sm font-semibold text-slate-800">{team.team_name}</p>
                </div>
                <div className="grid flex-1 grid-cols-4 divide-x divide-slate-100 sm:grid-cols-7">
                  {KPI_CARDS.map(({ key, label }) => (
                    <div key={key} className="px-2 text-center">
                      <p className="text-sm font-semibold text-slate-800">
                        {team.kpi[key] === null ? "—" : team.kpi[key]!.toLocaleString("vi-VN")}
                      </p>
                      <p className="text-[10px] text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex w-32 shrink-0 items-center gap-2">
                  <ProgressBar percent={team.kpi.performance_rate ?? 0} />
                  <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-600">
                    {team.kpi.performance_rate === null ? "—" : `${team.kpi.performance_rate}%`}
                  </span>
                </div>
              </div>
            ))}
            {sortedTeams.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Chưa có nhóm nào.</p>}
          </div>
        </Card>
      )}

      {/* 4. Hiệu suất từng nhân viên */}
      {canViewPerformance && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Hiệu suất từng nhân viên</h2>
            <Select
              uiSize="xs"
              className="w-40"
              value={employeeSort}
              onChange={(event) => setEmployeeSort(event.target.value as EmployeeSort)}
            >
              <option value="employed">Sắp xếp: Đi làm</option>
              <option value="new_leads">Sắp xếp: Data</option>
              <option value="performance">Sắp xếp: Hiệu suất</option>
            </Select>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-400 text-xs text-slate-500">
                  <th className="border-r border-slate-100 py-2 pr-3 font-medium">Nhân viên</th>
                  <th className="border-r border-slate-100 py-2 pr-3 text-center font-medium">Data mới</th>
                  <th className="border-r border-slate-100 py-2 pr-3 text-center font-medium">Hẹn PV</th>
                  <th className="border-r border-slate-100 py-2 pr-3 text-center font-medium">Đến PV</th>
                  <th className="border-r border-slate-100 py-2 pr-3 text-center font-medium">Bùng PV</th>
                  <th className="border-r border-slate-100 py-2 pr-3 text-center font-medium">Đỗ PV</th>
                  <th className="border-r border-slate-100 py-2 pr-3 text-center font-medium">Trượt PV</th>
                  <th className="border-r border-slate-100 py-2 pr-3 text-center font-medium">Đi làm</th>
                  <th className="py-2 pr-3 font-medium">Hiệu suất</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerformance.map((row) => (
                  <tr
                    key={row.account_id}
                    className="cursor-pointer border-b border-brand-400 last:border-0 hover:bg-slate-50"
                    onClick={() => setQuickView(row)}
                  >
                    <td className="border-r border-slate-100 py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <Avatar fullName={row.full_name} avatarUrl={row.avatar_url} className="h-7 w-7 text-xs" />
                        <div>
                          <p className="font-medium text-slate-800">{row.full_name}</p>
                          {row.team_id && <p className="text-[11px] text-slate-400">{teamNameById.get(row.team_id) ?? ""}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="border-r border-slate-100 py-2.5 pr-3 text-center text-slate-600">{row.kpi.new_leads.toLocaleString("vi-VN")}</td>
                    <td className="border-r border-slate-100 py-2.5 pr-3 text-center text-slate-600">{row.kpi.interview_scheduled.toLocaleString("vi-VN")}</td>
                    <td className="border-r border-slate-100 py-2.5 pr-3 text-center text-slate-600">{row.kpi.attended.toLocaleString("vi-VN")}</td>
                    <td className="border-r border-slate-100 py-2.5 pr-3 text-center text-slate-600">{row.kpi.no_show.toLocaleString("vi-VN")}</td>
                    <td className="border-r border-slate-100 py-2.5 pr-3 text-center text-slate-600">{row.kpi.passed.toLocaleString("vi-VN")}</td>
                    <td className="border-r border-slate-100 py-2.5 pr-3 text-center text-slate-600">{row.kpi.failed.toLocaleString("vi-VN")}</td>
                    <td className="border-r border-slate-100 py-2.5 pr-3 text-center font-semibold text-slate-800">
                      {row.kpi.employed === null ? "—" : row.kpi.employed.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <ProgressBar percent={row.kpi.performance_rate ?? 0} />
                        </div>
                        <span className="w-9 shrink-0 text-xs font-semibold text-slate-600">
                          {row.kpi.performance_rate === null ? "—" : `${row.kpi.performance_rate}%`}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedPerformance.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-sm text-slate-400">
                      Không có dữ liệu trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {quickView && (
        <Modal
          title={quickView.full_name}
          description="Tóm tắt hiệu suất trong khoảng thời gian đã chọn"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setQuickView(null)}>
                Đóng
              </Button>
              <Link href={`/reports?account_id=${quickView.account_id}${dateRangeQuery ? `&${dateRangeQuery}` : ""}`}>
                <Button variant="primary" size="sm">
                  Xem chi tiết trong Báo cáo
                </Button>
              </Link>
            </>
          }
        >
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Số cuộc gọi</dt>
              <dd className="font-semibold text-slate-900">{quickView.calls.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Lead tiềm năng</dt>
              <dd className="font-semibold text-slate-900">{quickView.potential_leads.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Data mới</dt>
              <dd className="font-semibold text-slate-900">{quickView.kpi.new_leads.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Hẹn PV</dt>
              <dd className="font-semibold text-slate-900">{quickView.kpi.interview_scheduled.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Đến PV</dt>
              <dd className="font-semibold text-slate-900">{quickView.kpi.attended.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Bùng PV</dt>
              <dd className="font-semibold text-slate-900">{quickView.kpi.no_show.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Đỗ PV</dt>
              <dd className="font-semibold text-slate-900">{quickView.kpi.passed.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Trượt PV</dt>
              <dd className="font-semibold text-slate-900">{quickView.kpi.failed.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Đi làm</dt>
              <dd className="font-semibold text-slate-900">
                {quickView.kpi.employed === null ? "—" : quickView.kpi.employed.toLocaleString("vi-VN")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Hiệu suất (%)</dt>
              <dd className="font-semibold text-accent-600">
                {quickView.kpi.performance_rate === null ? "—" : `${quickView.kpi.performance_rate}%`}
              </dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}

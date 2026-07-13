"use client";

import { useState } from "react";
import Link from "next/link";
import { PhoneCall, RefreshCw, Sparkles, Target } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import type { AccountRole, DashboardSummary, FunnelStep, SalePerformance, Team, TeamSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { computeDateRange, type DateRangeValue } from "@/lib/date-range";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";

/**
 * Mục 8, docs/13-api-design.md — GET /dashboard/summary: hiện với mọi vai trò.
 * Dự án phụ — nâng cấp toàn diện: bổ sung "sale" — Sale giờ cũng xem được
 * "Chờ phân chia" (tự nhận data). Thẻ "Cột chăm sóc" đã ẩn khỏi Dashboard.
 */
const PENDING_VIEW_ROLES: AccountRole[] = ["admin", "manager", "leader", "mkt", "sale"];


function FunnelBar({ funnel }: { funnel: FunnelStep[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {funnel.map((step) => (
        <div key={step.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{step.count.toLocaleString("vi-VN")}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-600">{step.label}</p>
          <Badge variant={step.code === "LEAD" ? "neutral" : "info"} className="mt-1.5">
            {step.percentage}%
          </Badge>
        </div>
      ))}
    </div>
  );
}

export function DashboardClient({
  currentUserFullName,
  currentUserRole,
  canViewPerformance,
  canViewByTeam,
  canFilterByTeam,
  teams,
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
  initialSummary: DashboardSummary;
  initialPerformance: SalePerformance[];
  initialByTeam: TeamSummary[];
}) {
  useSetPageTitle("Dashboard", `Xin chào, ${currentUserFullName} — tổng quan số liệu hệ thống.`);

  const [summary, setSummary] = useState(initialSummary);
  const [performance, setPerformance] = useState(initialPerformance);
  const [byTeam, setByTeam] = useState(initialByTeam);
  /**
   * Dự án phụ — nâng cấp toàn diện: bộ lọc ngày kiểu Google Analytics dùng
   * chung (xem components/ui/date-range-picker.tsx) — mặc định "Tháng này"
   * khớp preset gốc đã chốt (Mục 1, docs/12: 4 preset today/week/month/
   * custom cho Dashboard) — công thức tính ngày cho các preset này giữ
   * nguyên y hệt (nay chuyển vào computeDateRange() dùng chung, lib/date-
   * range.ts), chỉ đổi giao diện chọn, không đổi nghiệp vụ.
   */
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => ({
    preset: "this_month",
    ...computeDateRange("this_month"),
  }));
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [quickView, setQuickView] = useState<SalePerformance | null>(null);

  const canViewPending = PENDING_VIEW_ROLES.includes(currentUserRole);

  function buildDateQuery(): URLSearchParams {
    const query = new URLSearchParams();
    if (dateRange.from) query.set("date_from", new Date(dateRange.from).toISOString());
    if (dateRange.to) query.set("date_to", new Date(`${dateRange.to}T23:59:59.999`).toISOString());
    return query;
  }

  async function refresh() {
    const query = buildDateQuery();
    if (canFilterByTeam && teamId) query.set("team_id", teamId);

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

  const dateRangeQuery = buildDateQuery().toString();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card className="p-5">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void refresh();
          }}
        >
          <Field label="Khoảng thời gian" uiSize="sm" className="w-44">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </Field>
          {canFilterByTeam && (
            <Field label="Nhóm" uiSize="sm" className="w-48">
              <Select uiSize="sm" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                <option value="">Tất cả nhóm</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button type="submit" variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2} />
            Làm mới dữ liệu
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            <p className="text-xs font-medium">Lead mới</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.new_leads_total.toLocaleString("vi-VN")}</p>
          <div className="mt-2 space-y-1">
            {summary.new_leads_by_source.map((row) => (
              <div key={row.source_id} className="flex items-center justify-between text-xs text-slate-500">
                <span>{row.source_name}</span>
                <span className="font-medium text-slate-700">{row.count.toLocaleString("vi-VN")}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <PhoneCall className="h-4 w-4" strokeWidth={2} />
            <p className="text-xs font-medium">Lead chờ phân chia</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.pending_count.toLocaleString("vi-VN")}</p>
          {canViewPending && (
            <Link href="/candidates?view=pending" className="mt-2 inline-block text-xs font-medium text-accent-600 hover:underline">
              Xem chi tiết →
            </Link>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Target className="h-4 w-4" strokeWidth={2} />
            <p className="text-xs font-medium">Tỷ lệ đi làm</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {(summary.funnel.find((step) => step.code === "EMPLOYED")?.percentage ?? 0).toLocaleString("vi-VN")}%
          </p>
          <p className="mt-2 text-xs text-slate-400">So với tổng số Lead trong khoảng thời gian đã chọn</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Phễu chuyển đổi</h2>
        <p className="text-xs text-slate-500">Lead → Hẹn PV → Đến PV → Đỗ PV → Đi làm</p>
        <div className="mt-4">
          <FunnelBar funnel={summary.funnel} />
        </div>
      </Card>

      {canViewPerformance && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Hiệu suất Sale</h2>
          <div className="mt-3 overflow-x-auto">
            {/* UI Polish — cố định độ rộng cột theo yêu cầu người dùng, bỏ tính năng co giãn. */}
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[180px]" />
                <col className="w-[130px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[110px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Sale</th>
                  <th className="py-2 pr-3 font-medium">Số cuộc gọi</th>
                  <th className="py-2 pr-3 font-medium">Lead tiềm năng</th>
                  <th className="py-2 pr-3 font-medium">Số lịch hẹn</th>
                  <th className="py-2 pr-3 font-medium">Đi làm</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((row) => (
                  <tr
                    key={row.account_id}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    onClick={() => setQuickView(row)}
                  >
                    <td className="py-2 pr-3 font-medium text-slate-800">{row.full_name}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.calls.toLocaleString("vi-VN")}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.potential_leads.toLocaleString("vi-VN")}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.interview_count.toLocaleString("vi-VN")}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.employed_count.toLocaleString("vi-VN")}</td>
                  </tr>
                ))}
                {performance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                      Không có dữ liệu trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canViewByTeam && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Tổng hợp theo nhóm</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Nhóm</th>
                  <th className="py-2 pr-3 font-medium">Số lead</th>
                  <th className="py-2 pr-3 font-medium">Tỷ lệ chuyển đổi</th>
                  <th className="py-2 pr-3 font-medium">Cột chăm sóc</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {byTeam.map((row) => (
                  <tr key={row.team_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-3 font-medium text-slate-800">{row.team_name}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.lead_count.toLocaleString("vi-VN")}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.conversion_rate}%</td>
                    <td className="py-2 pr-3 text-slate-600">{row.care_pool_count.toLocaleString("vi-VN")}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/candidates?team_id=${row.team_id}`}
                        className="text-xs font-medium text-accent-600 hover:underline"
                      >
                        Xem lao động →
                      </Link>
                    </td>
                  </tr>
                ))}
                {byTeam.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                      Chưa có nhóm nào.
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
              <dt className="text-xs text-slate-500">Số lịch hẹn</dt>
              <dd className="font-semibold text-slate-900">{quickView.interview_count.toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Đi làm</dt>
              <dd className="font-semibold text-slate-900">{quickView.employed_count.toLocaleString("vi-VN")}</dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}

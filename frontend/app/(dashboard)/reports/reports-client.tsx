"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import type { BySourceReport, FunnelStep, LeadSource, Team, TeamMember } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { computeDateRange, isoToLocalDateOnly, type DateRangeValue } from "@/lib/date-range";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";

interface ReportFilters {
  team_id: string;
  account_id: string;
  source_id: string;
  date_from: string;
  date_to: string;
}

export function ReportsClient({
  canFilterByTeam,
  teams,
  saleMembers,
  sources,
  initialDatePresetIsCustom,
  initialFilters,
  initialFunnel,
  initialBySource,
}: {
  canFilterByTeam: boolean;
  teams: Team[];
  saleMembers: TeamMember[];
  sources: LeadSource[];
  initialDatePresetIsCustom: boolean;
  initialFilters: ReportFilters;
  initialFunnel: FunnelStep[];
  initialBySource: BySourceReport[];
}) {
  useSetPageTitle("Báo cáo", "Bộ lọc chi tiết và breakdown số liệu — mở rộng của Dashboard.");

  const [funnel, setFunnel] = useState(initialFunnel);
  const [bySource, setBySource] = useState(initialBySource);
  /**
   * Dự án phụ — nâng cấp toàn diện: bộ lọc ngày kiểu Google Analytics dùng
   * chung (xem components/ui/date-range-picker.tsx) — mặc định "Tháng này"
   * khớp preset gốc đã chốt (Mục 8, docs/12: Báo cáo là "mở rộng của
   * Dashboard", dùng chung mặc định preset). initialFilters.date_from/to
   * luôn là ISO datetime đầy đủ (server tự tính mặc định hoặc lấy từ link
   * "Xem chi tiết" ở Dashboard) — đổi sang "YYYY-MM-DD" bằng
   * isoToLocalDateOnly() để đổ vào DateRangePicker.
   */
  const [dateRange, setDateRange] = useState<DateRangeValue>(() =>
    initialDatePresetIsCustom
      ? {
          preset: "custom",
          from: isoToLocalDateOnly(initialFilters.date_from),
          to: isoToLocalDateOnly(initialFilters.date_to),
        }
      : { preset: "this_month", ...computeDateRange("this_month") },
  );
  const [teamId, setTeamId] = useState(initialFilters.team_id);
  const [accountId, setAccountId] = useState(initialFilters.account_id);
  const [sourceId, setSourceId] = useState(initialFilters.source_id);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  function buildDateQuery(): URLSearchParams {
    const query = new URLSearchParams();
    if (dateRange.from) query.set("date_from", new Date(dateRange.from).toISOString());
    if (dateRange.to) query.set("date_to", new Date(`${dateRange.to}T23:59:59.999`).toISOString());
    return query;
  }

  async function refresh() {
    const baseQuery = buildDateQuery();
    if (canFilterByTeam && teamId) baseQuery.set("team_id", teamId);
    if (sourceId) baseQuery.set("source_id", sourceId);

    const funnelQuery = new URLSearchParams(baseQuery);
    if (accountId) funnelQuery.set("account_id", accountId);

    setLoading(true);
    try {
      const [nextFunnel, nextBySource] = await Promise.all([
        clientApi<FunnelStep[]>(`/report/funnel?${funnelQuery.toString()}`),
        clientApi<BySourceReport[]>(`/report/by-source?${baseQuery.toString()}`),
      ]);
      setFunnel(nextFunnel);
      setBySource(nextBySource);
    } catch {
      toast.error("Không tải được báo cáo, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function candidateLinkParams(extra?: Record<string, string>): string {
    const params = new URLSearchParams();
    if (dateRange.from) params.set("date_from", dateRange.from);
    if (dateRange.to) params.set("date_to", dateRange.to);
    if (teamId) params.set("team_id", teamId);
    if (accountId) params.set("assigned_to", accountId);
    if (sourceId) params.set("source_id", sourceId);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) params.set(key, value);
    }
    return params.toString();
  }

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
            <Field label="Nhóm" uiSize="sm" className="w-44">
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
          <Field label="Sale" uiSize="sm" className="w-44">
            <Select uiSize="sm" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Tất cả Sale</option>
              {saleMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nguồn" uiSize="sm" className="w-40">
            <Select uiSize="sm" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              <option value="">Tất cả nguồn</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2} />
            Làm mới dữ liệu
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Phễu chuyển đổi</h2>
        <p className="text-xs text-slate-500">Lead → Hẹn PV → Đến PV → Đỗ PV → Đi làm</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Bước</th>
                <th className="py-2 pr-3 font-medium">Số lượng</th>
                <th className="py-2 pr-3 font-medium">Tỷ lệ</th>
                <th className="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((step) => {
                // Phễu đếm theo TOÀN BỘ lịch sử phỏng vấn (đã từng đạt mốc
                // đó — vd đã từng Đỗ PV dù sau đó có lịch hẹn PV mới ghi đè
                // trạng thái hiện tại), còn GET /candidate chỉ lọc được theo
                // trạng thái phỏng vấn/đi làm HIỆN TẠI (lần hẹn gần nhất —
                // lead-pipeline.service.ts). 2 mốc PASSED/EMPLOYED do đó
                // KHÔNG đảm bảo khớp 1:1 nếu lead có hẹn PV mới sau khi đã
                // đạt mốc đó — chỉ bước LEAD (không lọc theo trạng thái) mới
                // chắc chắn khớp đúng số, nên chỉ bước này có link.
                const href = step.code === "LEAD" ? `/candidates?${candidateLinkParams()}` : undefined;
                return (
                  <tr key={step.code} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800">{step.label}</td>
                    <td className="py-2 pr-3 text-slate-600">{step.count.toLocaleString("vi-VN")}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={step.code === "LEAD" ? "neutral" : "info"}>{step.percentage}%</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {href && (
                        <Link href={href} className="text-xs font-medium text-accent-600 hover:underline">
                          Xem danh sách →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Theo nguồn kênh</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Nguồn</th>
                <th className="py-2 pr-3 font-medium">Số lead</th>
                <th className="py-2 pr-3 font-medium">Tỷ lệ tiềm năng</th>
                <th className="py-2 pr-3 font-medium">Tỷ lệ đi làm</th>
                <th className="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {bySource.map((row) => (
                <tr key={row.source_id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 font-medium text-slate-800">{row.source_name}</td>
                  <td className="py-2 pr-3 text-slate-600">{row.lead_count.toLocaleString("vi-VN")}</td>
                  <td className="py-2 pr-3 text-slate-600">{row.potential_rate}%</td>
                  <td className="py-2 pr-3 text-slate-600">{row.employed_rate}%</td>
                  <td className="py-2 pr-3">
                    <Link
                      href={`/candidates?${candidateLinkParams({ source_id: row.source_id })}`}
                      className="text-xs font-medium text-accent-600 hover:underline"
                    >
                      Xem danh sách →
                    </Link>
                  </td>
                </tr>
              ))}
              {bySource.length === 0 && (
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
    </div>
  );
}

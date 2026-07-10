"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import type { BySourceReport, FunnelStep, LeadSource, Team, TeamMember } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Banner } from "@/components/ui/banner";
import { useSetPageTitle } from "@/lib/page-title-context";

type DatePreset = "today" | "week" | "month" | "custom";

const DATE_PRESET_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
  { value: "custom", label: "Tùy chọn..." },
];

function computeDateRange(preset: DatePreset, customFrom: string, customTo: string): { date_from: string; date_to: string } | null {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

  if (preset === "custom") {
    if (!customFrom && !customTo) return null;
    return {
      date_from: customFrom ? new Date(customFrom).toISOString() : "",
      date_to: customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : "",
    };
  }
  if (preset === "today") {
    return { date_from: startOfToday.toISOString(), date_to: endOfToday.toISOString() };
  }
  if (preset === "week") {
    const dayIndex = (startOfToday.getDay() + 6) % 7;
    const start = new Date(startOfToday.getTime() - dayIndex * 24 * 60 * 60 * 1000);
    return { date_from: start.toISOString(), date_to: endOfToday.toISOString() };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { date_from: start.toISOString(), date_to: endOfToday.toISOString() };
}

/**
 * Đổi 1 mốc thời gian (ISO, UTC) sang chuỗi ngày dương lịch "YYYY-MM-DD"
 * theo giờ ĐỊA PHƯƠNG — không dùng iso.slice(0, 10) vì đó là ngày theo giờ
 * UTC, lệch mất 1 ngày ở múi giờ Việt Nam (UTC+7) khi ISO rơi vào khoảng
 * 00:00–07:00 giờ VN.
 */
function toLocalDateInputValue(iso: string): string {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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
  const [datePreset, setDatePreset] = useState<DatePreset>(initialDatePresetIsCustom ? "custom" : "month");
  const [customFrom, setCustomFrom] = useState(
    initialDatePresetIsCustom && initialFilters.date_from ? toLocalDateInputValue(initialFilters.date_from) : "",
  );
  const [customTo, setCustomTo] = useState(
    initialDatePresetIsCustom && initialFilters.date_to ? toLocalDateInputValue(initialFilters.date_to) : "",
  );
  const [teamId, setTeamId] = useState(initialFilters.team_id);
  const [accountId, setAccountId] = useState(initialFilters.account_id);
  const [sourceId, setSourceId] = useState(initialFilters.source_id);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "error"; text: string } | null>(null);

  async function refresh() {
    const range = computeDateRange(datePreset, customFrom, customTo);
    const baseQuery = new URLSearchParams();
    if (range?.date_from) baseQuery.set("date_from", range.date_from);
    if (range?.date_to) baseQuery.set("date_to", range.date_to);
    if (canFilterByTeam && teamId) baseQuery.set("team_id", teamId);
    if (sourceId) baseQuery.set("source_id", sourceId);

    const funnelQuery = new URLSearchParams(baseQuery);
    if (accountId) funnelQuery.set("account_id", accountId);

    setLoading(true);
    setBanner(null);
    try {
      const [nextFunnel, nextBySource] = await Promise.all([
        clientApi<FunnelStep[]>(`/report/funnel?${funnelQuery.toString()}`),
        clientApi<BySourceReport[]>(`/report/by-source?${baseQuery.toString()}`),
      ]);
      setFunnel(nextFunnel);
      setBySource(nextBySource);
    } catch {
      setBanner({ type: "error", text: "Không tải được báo cáo, vui lòng thử lại." });
    } finally {
      setLoading(false);
    }
  }

  function candidateLinkParams(extra?: Record<string, string>): string {
    const range = computeDateRange(datePreset, customFrom, customTo);
    const params = new URLSearchParams();
    if (range?.date_from) params.set("date_from", toLocalDateInputValue(range.date_from));
    if (range?.date_to) params.set("date_to", toLocalDateInputValue(range.date_to));
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
      {banner && <Banner type={banner.type} text={banner.text} />}

      <Card className="p-5">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void refresh();
          }}
        >
          <Field label="Khoảng thời gian" uiSize="sm" className="w-40">
            <Select uiSize="sm" value={datePreset} onChange={(event) => setDatePreset(event.target.value as DatePreset)}>
              {DATE_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          {datePreset === "custom" && (
            <>
              <Field label="Từ ngày" uiSize="sm" className="w-40">
                <Input uiSize="sm" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
              </Field>
              <Field label="Đến ngày" uiSize="sm" className="w-40">
                <Input uiSize="sm" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
              </Field>
            </>
          )}
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

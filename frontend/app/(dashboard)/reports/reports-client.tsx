"use client";

import { useState } from "react";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ClipboardEdit,
  ClipboardPlus,
  Database,
  Heart,
  PhoneCall,
  PhoneMissed,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type {
  AccountRole,
  DailyReportRow,
  DailyReportSummary,
  DailyReportTotals,
  Team,
  TeamMember,
  UpsertDailyReportPayload,
} from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { NameWithRoleHint } from "@/components/name-with-role-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRangeValue } from "@/lib/date-range";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";

type MetricKey = keyof DailyReportTotals;

const METRIC_CARDS: Array<{ key: MetricKey; label: string; icon: typeof PhoneCall; tint: string; iconColor: string }> = [
  { key: "calls", label: "Tổng số gọi", icon: PhoneCall, tint: "bg-brand-50", iconColor: "text-brand-600" },
  { key: "new_leads", label: "Data mới", icon: Sparkles, tint: "bg-brand-50", iconColor: "text-brand-600" },
  { key: "old_data", label: "Data cũ", icon: Database, tint: "bg-slate-100", iconColor: "text-slate-600" },
  { key: "no_answer", label: "Không nghe máy", icon: PhoneMissed, tint: "bg-red-50", iconColor: "text-red-600" },
  { key: "interested", label: "Quan tâm", icon: Heart, tint: "bg-pink-50", iconColor: "text-pink-600" },
  { key: "interview_scheduled", label: "Hẹn PV", icon: CalendarClock, tint: "bg-brand-50", iconColor: "text-brand-600" },
  { key: "interview_passed", label: "Đỗ PV", icon: CheckCircle2, tint: "bg-emerald-50", iconColor: "text-emerald-600" },
  { key: "employed", label: "Đi làm", icon: Briefcase, tint: "bg-accent-50", iconColor: "text-accent-600" },
];

const FORM_FIELDS: Array<{ key: keyof UpsertDailyReportPayload; label: string }> = [
  { key: "calls", label: "Tổng số gọi" },
  { key: "old_data", label: "Data cũ" },
  { key: "no_answer", label: "Không nghe máy" },
  { key: "interested", label: "Quan tâm" },
  { key: "interview_scheduled", label: "Hẹn PV" },
  { key: "interview_passed", label: "Đỗ PV" },
  { key: "employed", label: "Đi làm" },
];

function formatDateVN(dateOnly: string): string {
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
}

function toPayload(row: DailyReportRow): UpsertDailyReportPayload {
  return {
    calls: row.calls,
    old_data: row.old_data,
    no_answer: row.no_answer,
    interested: row.interested,
    interview_scheduled: row.interview_scheduled,
    interview_passed: row.interview_passed,
    employed: row.employed,
  };
}

/** Mục 8, yêu cầu người dùng: popup nhập/sửa báo cáo hằng ngày — grid 2 cột, Data mới readonly. */
function DailyReportEntryModal({
  row,
  onClose,
  onSaved,
}: {
  row: DailyReportRow;
  onClose: () => void;
  onSaved: (row: DailyReportRow) => void;
}) {
  const [form, setForm] = useState<UpsertDailyReportPayload>(toPayload(row));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function setField(key: keyof UpsertDailyReportPayload, raw: string) {
    const parsed = raw === "" ? 0 : Math.max(0, Math.floor(Number(raw)));
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  }

  async function handleSave() {
    setIsSubmitting(true);
    setError(null);
    try {
      const saved = row.report_id
        ? await clientApi<DailyReportRow>(`/daily-report/${row.report_id}`, {
            method: "PUT",
            body: JSON.stringify(form),
          })
        : await clientApi<DailyReportRow>("/daily-report", {
            method: "POST",
            body: JSON.stringify(form),
          });
      toast.success(row.report_id ? "Đã cập nhật báo cáo hôm nay" : "Đã lưu báo cáo hằng ngày");
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={row.report_id ? "Sửa báo cáo hôm nay" : "Nhập báo cáo hằng ngày"}
      description={`${formatDateVN(row.date)} · ${row.account.name}${row.team ? ` · ${row.team.name}` : ""}`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSave()}>
            {isSubmitting ? "Đang lưu..." : "Lưu báo cáo"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tổng số gọi">
          <Input
            type="number"
            min={0}
            step={1}
            value={form.calls}
            onChange={(event) => setField("calls", event.target.value)}
          />
        </Field>
        <Field label="Data mới" hint="Tự động lấy từ Data lao động, không chỉnh được">
          <Input value={row.new_leads} disabled readOnly />
        </Field>
        {FORM_FIELDS.filter((f) => f.key !== "calls").map((field) => (
          <Field key={field.key} label={field.label}>
            <Input
              type="number"
              min={0}
              step={1}
              value={form[field.key]}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          </Field>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </Modal>
  );
}

/** Mục 7, yêu cầu người dùng: "Xem chi tiết" — chỉ đọc, tái dùng đúng dữ liệu dòng đã có, không gọi API riêng. */
function DailyReportDetailModal({ row, onClose }: { row: DailyReportRow; onClose: () => void }) {
  return (
    <Modal
      title="Chi tiết báo cáo hằng ngày"
      description={`${formatDateVN(row.date)} · ${row.account.name}${row.team ? ` · ${row.team.name}` : ""}`}
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {METRIC_CARDS.map(({ key, label }) => (
          <div key={key}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-900">{row[key].toLocaleString("vi-VN")}</dd>
          </div>
        ))}
        {row.created_by && (
          <div className="col-span-2 border-t border-slate-100 pt-3">
            <dt className="text-xs text-slate-500">Tạo lúc</dt>
            <dd className="text-slate-700">
              {row.created_at && new Date(row.created_at).toLocaleString("vi-VN")} bởi{" "}
              <NameWithRoleHint account={row.created_by} />
            </dd>
          </div>
        )}
        {row.updated_by && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">Cập nhật lúc</dt>
            <dd className="text-slate-700">
              {row.updated_at && new Date(row.updated_at).toLocaleString("vi-VN")} bởi{" "}
              <NameWithRoleHint account={row.updated_by} />
            </dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}

export function ReportsClient({
  currentUserRole,
  canFilterByTeam,
  canFilterBySale,
  canSubmitReport,
  teams,
  saleMembers,
  initialDateFrom,
  initialDateTo,
  initialSummary,
  initialRows,
}: {
  currentUserRole: AccountRole;
  canFilterByTeam: boolean;
  canFilterBySale: boolean;
  canSubmitReport: boolean;
  teams: Team[];
  saleMembers: TeamMember[];
  initialDateFrom: string;
  initialDateTo: string;
  initialSummary: DailyReportSummary;
  initialRows: DailyReportRow[];
}) {
  useSetPageTitle("Báo cáo hằng ngày", "Theo dõi hiệu suất từng nhóm và từng nhân viên theo ngày.");

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    preset: "today",
    from: initialDateFrom,
    to: initialDateTo,
  });
  const [teamId, setTeamId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [summary, setSummary] = useState(initialSummary);
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  /** Dòng "hôm nay của chính mình" — độc lập với bộ lọc đang xem, quyết định nút Nhập/Sửa (Mục 2, 4). */
  const [myTodayRow, setMyTodayRow] = useState<DailyReportRow | null>(
    canSubmitReport ? (initialRows[0] ?? null) : null,
  );
  const [entryTarget, setEntryTarget] = useState<DailyReportRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<DailyReportRow | null>(null);
  const toast = useToast();

  function buildQuery(overrides?: { dateRange?: DateRangeValue; teamId?: string; accountId?: string }): URLSearchParams {
    const effectiveDateRange = overrides?.dateRange ?? dateRange;
    const effectiveTeamId = overrides?.teamId ?? teamId;
    const effectiveAccountId = overrides?.accountId ?? accountId;
    const query = new URLSearchParams();
    if (effectiveDateRange.from) query.set("date_from", effectiveDateRange.from);
    if (effectiveDateRange.to) query.set("date_to", effectiveDateRange.to);
    if (canFilterByTeam && effectiveTeamId) query.set("team_id", effectiveTeamId);
    if (canFilterBySale && effectiveAccountId) query.set("account_id", effectiveAccountId);
    return query;
  }

  async function refresh(overrides?: { dateRange?: DateRangeValue; teamId?: string; accountId?: string }) {
    const query = buildQuery(overrides);
    setLoading(true);
    try {
      const [nextSummary, nextRows] = await Promise.all([
        clientApi<DailyReportSummary>(`/daily-report/summary?${query.toString()}`),
        clientApi<DailyReportRow[]>(`/daily-report?${query.toString()}`),
      ]);
      setSummary(nextSummary);
      setRows(nextRows);
    } catch {
      toast.error("Không tải được báo cáo, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  /** Mở popup nhập/sửa cho đúng "hôm nay của mình" — nếu đang không xem đúng hôm nay thì tải riêng 1 lần trước khi mở. */
  async function openEntryModal() {
    if (myTodayRow) {
      setEntryTarget(myTodayRow);
      return;
    }
    try {
      const todayRows = await clientApi<DailyReportRow[]>("/daily-report");
      const todayRow = todayRows[0] ?? null;
      setMyTodayRow(todayRow);
      if (todayRow) setEntryTarget(todayRow);
    } catch {
      toast.error("Không tải được báo cáo hôm nay, vui lòng thử lại.");
    }
  }

  function handleSaved(saved: DailyReportRow) {
    setEntryTarget(null);
    setMyTodayRow(saved);
    void refresh();
  }

  const showByTeam = currentUserRole !== "sale" && summary.by_team.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
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
          {canFilterBySale && (
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
                {saleMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="ml-auto flex items-center gap-2">
            {canSubmitReport && (
              <Button type="button" onClick={() => void openEntryModal()}>
                {myTodayRow?.report_id ? <ClipboardEdit className="h-4 w-4" strokeWidth={2} /> : <ClipboardPlus className="h-4 w-4" strokeWidth={2} />}
                {myTodayRow?.report_id ? "Sửa báo cáo hôm nay" : "Nhập báo cáo hằng ngày"}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2} />
              Làm mới
            </Button>
          </div>
        </div>
      </Card>

      {canSubmitReport && !myTodayRow?.report_id && (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-accent-200 bg-accent-50/60 p-3">
          <p className="text-sm text-accent-800">Hôm nay bạn chưa nộp báo cáo.</p>
          <Button type="button" size="sm" onClick={() => void openEntryModal()}>
            <ClipboardPlus className="h-4 w-4" strokeWidth={2} />
            Nhập ngay
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {METRIC_CARDS.map(({ key, label, icon: Icon, tint, iconColor }) => (
          <Card key={key} className="flex min-h-[100px] flex-col gap-2 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tint}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={2} />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-brand-900">{summary.totals[key].toLocaleString("vi-VN")}</p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {showByTeam && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900">Báo cáo theo nhóm</h2>
          <p className="text-xs text-slate-500">Tổng hợp theo đúng bộ lọc hiện tại — bấm vào nhóm để chỉ xem nhân viên nhóm đó.</p>
          <div className="mt-3 flex flex-col divide-y divide-brand-400">
            {summary.by_team.map((team) => (
              <button
                key={team.team_id || "none"}
                type="button"
                onClick={() => {
                  if (!team.team_id) return;
                  setTeamId(team.team_id);
                  void refresh({ teamId: team.team_id });
                }}
                className="flex flex-wrap items-center gap-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <div className="w-36 shrink-0">
                  <p className="text-sm font-semibold text-slate-800">{team.team_name}</p>
                  <p className="text-[11px] text-slate-400">
                    <span className="font-medium text-emerald-600">{team.reported_count} đã nộp</span>
                    {" · "}
                    <span className="font-medium text-red-500">{team.not_reported_count} chưa nộp</span>
                  </p>
                </div>
                <div className="grid flex-1 grid-cols-4 divide-x divide-slate-100 sm:grid-cols-8">
                  {METRIC_CARDS.map(({ key, label }) => (
                    <div key={key} className="px-2 text-center">
                      <p className="text-sm font-semibold text-slate-800">{team[key].toLocaleString("vi-VN")}</p>
                      <p className="text-[10px] text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900">Báo cáo theo nhân viên</h2>
        <div className="mt-3 max-h-[70vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-brand-400 text-xs text-slate-500">
                <th className="border-r border-slate-100 py-2 pr-3 font-medium">Ngày</th>
                <th className="border-r border-slate-100 py-2 pr-3 font-medium">Nhân viên</th>
                <th className="border-r border-slate-100 py-2 pr-3 font-medium">Nhóm</th>
                {METRIC_CARDS.map(({ key, label }) => (
                  <th key={key} className="border-r border-slate-100 py-2 pr-3 text-center font-medium">
                    {label}
                  </th>
                ))}
                <th className="border-r border-slate-100 py-2 pr-3 font-medium">Trạng thái</th>
                <th className="py-2 pr-3 font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.account.id}_${row.date}`}
                  className="border-b border-brand-400 last:border-0 hover:bg-slate-50"
                >
                  <td className="border-r border-slate-100 py-2.5 pr-3 whitespace-nowrap text-slate-600">{formatDateVN(row.date)}</td>
                  <td className="border-r border-slate-100 py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar fullName={row.account.name} avatarUrl={row.account.avatar_url} className="h-7 w-7 text-xs" />
                      <span className="font-medium text-slate-800">{row.account.name}</span>
                    </div>
                  </td>
                  <td className="border-r border-slate-100 py-2.5 pr-3 text-slate-600">{row.team?.name ?? "—"}</td>
                  {METRIC_CARDS.map(({ key }) => (
                    <td key={key} className="border-r border-slate-100 py-2.5 pr-3 text-center text-slate-600">
                      {row[key].toLocaleString("vi-VN")}
                    </td>
                  ))}
                  <td className="border-r border-slate-100 py-2.5 pr-3">
                    <Badge variant={row.status === "reported" ? "success" : "warning"}>
                      {row.status === "reported" ? "Đã báo cáo" : "Chưa báo cáo"}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex gap-1">
                      {row.report_id && (
                        <Button type="button" variant="ghost" size="xs" onClick={() => setDetailTarget(row)}>
                          Xem chi tiết
                        </Button>
                      )}
                      {row.report_id && canSubmitReport && row.date === myTodayRow?.date && (
                        <Button type="button" variant="ghost" size="xs" onClick={() => setEntryTarget(row)}>
                          Sửa
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-sm text-slate-400">
                    Chưa có báo cáo trong khoảng thời gian này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {entryTarget && (
        <DailyReportEntryModal row={entryTarget} onClose={() => setEntryTarget(null)} onSaved={handleSaved} />
      )}
      {detailTarget && <DailyReportDetailModal row={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  );
}

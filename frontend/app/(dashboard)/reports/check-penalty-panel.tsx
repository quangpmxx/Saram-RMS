"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, Search, Settings2, X } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type {
  AccountRole,
  AppRealtimeEvent,
  PaginatedResult,
  ReportDeadline,
  ReportViolation,
  ReportViolationStatus,
  ReportViolationType,
  Team,
  TeamMember,
} from "@/lib/types";
import { useAppRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRangeValue, EMPTY_DATE_RANGE } from "@/lib/date-range";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

const VIOLATION_TYPE_OPTIONS: Array<{ value: ReportViolationType; label: string }> = [
  { value: "late_submission", label: "Nộp báo cáo muộn" },
  { value: "no_submission", label: "Không nộp báo cáo" },
];
const VIOLATION_TYPE_LABEL: Record<ReportViolationType, string> = {
  late_submission: "Nộp báo cáo muộn",
  no_submission: "Không nộp báo cáo",
};
const VIOLATION_TYPE_BADGE: Record<ReportViolationType, string> = {
  late_submission: "bg-amber-100 text-amber-700",
  no_submission: "bg-red-100 text-red-700",
};

const STATUS_OPTIONS: Array<{ value: ReportViolationStatus; label: string }> = [
  { value: "pending", label: "Chưa xử lý" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "waived", label: "Đã miễn phạt" },
  { value: "supplemented", label: "Đã nộp bổ sung" },
];
const STATUS_LABEL: Record<ReportViolationStatus, string> = {
  pending: "Chưa xử lý",
  confirmed: "Đã xác nhận",
  waived: "Đã miễn phạt",
  supplemented: "Đã nộp bổ sung",
};
const STATUS_BADGE: Record<ReportViolationStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  confirmed: "bg-blue-100 text-blue-700",
  waived: "bg-emerald-100 text-emerald-700",
  supplemented: "bg-purple-100 text-purple-700",
};

const PAGE_SIZE = 20;
const EMPLOYEE_ROLES = ["sale"];

function formatDateOnly(value: string): string {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check phạt" — trang con trong
 * module Báo cáo (Mục 1: "Không tạo module độc lập ngoài sidebar"). Tự
 * động ghi nhận Sale nộp Báo cáo hằng ngày muộn/không nộp — job quét chạy
 * ngầm (report-penalty-scanner.service.ts), trang này chỉ hiển thị + quản
 * lý kết quả (Mục 6/7/8).
 */
export function CheckPenaltyPanel({
  currentUserRole,
  canFilterByTeam,
  canFilterBySale,
  teams,
  saleMembers,
}: {
  currentUserRole: AccountRole;
  canFilterByTeam: boolean;
  canFilterBySale: boolean;
  teams: Team[];
  saleMembers: TeamMember[];
}) {
  const toast = useToast();
  const isAdmin = currentUserRole === "admin";
  const canManage = currentUserRole === "admin" || currentUserRole === "manager";
  const saleOptions = saleMembers.filter((m) => EMPLOYEE_ROLES.includes(m.role));

  const [dateRange, setDateRange] = useState<DateRangeValue>(EMPTY_DATE_RANGE);
  const [teamId, setTeamId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [violationType, setViolationType] = useState<ReportViolationType | "">("");
  const [status, setStatus] = useState<ReportViolationStatus | "">("");
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PaginatedResult<ReportViolation> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [deadline, setDeadline] = useState<ReportDeadline | null>(null);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [deadlineHour, setDeadlineHour] = useState("22");
  const [deadlineMinute, setDeadlineMinute] = useState("30");
  const [deadlineSubmitting, setDeadlineSubmitting] = useState(false);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<ReportViolation | null>(null);
  const [statusValue, setStatusValue] = useState<ReportViolationStatus>("confirmed");
  const [statusNote, setStatusNote] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    clientApi<ReportDeadline>("/report-penalty/deadline")
      .then((result) => {
        setDeadline(result);
        setDeadlineHour(String(result.hour));
        setDeadlineMinute(String(result.minute));
      })
      .catch(() => {
        // Không chặn trang nếu tải hạn thất bại — cột "Hạn nộp" tự tính lại theo bản ghi.
      });
  }, [refreshKey]);

  function buildViolationParams(): URLSearchParams {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (dateRange.from) params.set("date_from", dateRange.from);
    if (dateRange.to) params.set("date_to", dateRange.to);
    if (teamId) params.set("team_id", teamId);
    if (accountId) params.set("account_id", accountId);
    if (violationType) params.set("violation_type", violationType);
    if (status) params.set("status", status);
    if (keyword) params.set("keyword", keyword);
    return params;
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    const params = buildViolationParams();

    clientApi<PaginatedResult<ReportViolation>>(`/report-penalty?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Không tải được danh sách Check phạt");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, teamId, accountId, violationType, status, keyword, page, refreshKey]);

  /**
   * Yêu cầu người dùng (Mục 2) — "Check phạt mới xuất hiện ngay với người
   * có quyền xem... không refetch toàn bộ nếu chỉ 1 bảng bị ảnh hưởng".
   * Vá đúng dòng theo id nếu đang hiển thị trong trang hiện tại; nếu là vi
   * phạm MỚI có thể khớp trang/bộ lọc hiện tại thì tải nền lặng lẽ (không
   * bật `loading` toàn bảng, tránh nhấp nháy).
   */
  async function silentRefetch() {
    try {
      const params = buildViolationParams();
      const result = await clientApi<PaginatedResult<ReportViolation>>(`/report-penalty?${params.toString()}`);
      setData(result);
    } catch {
      // bỏ qua lỗi tải nền
    }
  }

  const [conflictViolationIds, setConflictViolationIds] = useState<Set<string>>(new Set());

  function handleAppRealtimeEvent(event: AppRealtimeEvent) {
    if (event.module !== "penalty") return;
    const violation = event.payload as ReportViolation | undefined;
    if (!violation) return;

    const items = data?.items ?? [];
    const existing = items.find((v) => v.id === violation.id);
    if (existing) {
      setData((prev) => (prev ? { ...prev, items: prev.items.map((v) => (v.id === violation.id ? violation : v)) } : prev));
      // Modal đang mở đúng bản ghi này (Mục 7) — không tự ghi đè lựa chọn
      // đang dở, chỉ đánh dấu để hiện cảnh báo nhỏ + cho phép tải lại.
      if (statusTarget?.id === violation.id) {
        setConflictViolationIds((prev) => new Set(prev).add(violation.id));
      }
      return;
    }

    if (event.action === "created") {
      void silentRefetch();
    }
  }

  useAppRealtime(handleAppRealtimeEvent);
  useRealtimeReconnect(() => void silentRefetch());

  function handleReloadConflictedViolation() {
    if (!statusTarget) return;
    const fresh = (data?.items ?? []).find((v) => v.id === statusTarget.id);
    if (fresh) {
      setStatusTarget(fresh);
      setStatusValue(fresh.status);
      setStatusNote(fresh.note ?? "");
    }
    setConflictViolationIds((prev) => {
      const next = new Set(prev);
      next.delete(statusTarget.id);
      return next;
    });
  }

  function updateFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function handleClearFilters() {
    setDateRange(EMPTY_DATE_RANGE);
    setTeamId("");
    setAccountId("");
    setViolationType("");
    setStatus("");
    setKeyword("");
    setKeywordInput("");
    setPage(1);
  }

  async function handleSaveDeadline() {
    setDeadlineError(null);
    const hour = Number(deadlineHour);
    const minute = Number(deadlineMinute);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      setDeadlineError("Giờ phải là số nguyên từ 0 đến 23");
      return;
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      setDeadlineError("Phút phải là số nguyên từ 0 đến 59");
      return;
    }
    setDeadlineSubmitting(true);
    try {
      const result = await clientApi<ReportDeadline>("/report-penalty/deadline", {
        method: "PUT",
        body: JSON.stringify({ hour, minute }),
      });
      setDeadline(result);
      setDeadlineModalOpen(false);
      toast.success("Đã lưu thời hạn nộp báo cáo");
    } catch (err) {
      setDeadlineError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setDeadlineSubmitting(false);
    }
  }

  function openStatusModal(violation: ReportViolation) {
    setStatusTarget(violation);
    setStatusValue(violation.status);
    setStatusNote(violation.note ?? "");
    setStatusError(null);
    setConflictViolationIds((prev) => {
      if (!prev.has(violation.id)) return prev;
      const next = new Set(prev);
      next.delete(violation.id);
      return next;
    });
  }

  async function handleSaveStatus() {
    if (!statusTarget) return;
    setStatusSubmitting(true);
    setStatusError(null);
    try {
      await clientApi(`/report-penalty/${statusTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusValue, note: statusNote.trim() || undefined }),
      });
      toast.success("Đã cập nhật trạng thái vi phạm");
      setStatusTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setStatusSubmitting(false);
    }
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasFilters = Boolean(dateRange.from || dateRange.to || teamId || accountId || violationType || status || keyword);

  return (
    <div className="space-y-4">
      <Card className="p-2">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Khoảng ngày" uiSize="xs" className="w-40">
            <DateRangePicker value={dateRange} onChange={(next) => updateFilter(() => setDateRange(next))} placeholder="Tất cả" allowClear />
          </Field>
          {canFilterByTeam && (
            <Field label="Nhóm" uiSize="xs" className="w-32">
              <Select uiSize="xs" value={teamId} onChange={(e) => updateFilter(() => setTeamId(e.target.value))}>
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
            <Field label="Nhân viên" uiSize="xs" className="w-36">
              <Select uiSize="xs" value={accountId} onChange={(e) => updateFilter(() => setAccountId(e.target.value))}>
                <option value="">Tất cả nhân viên</option>
                {saleOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Loại vi phạm" uiSize="xs" className="w-36">
            <Select uiSize="xs" value={violationType} onChange={(e) => updateFilter(() => setViolationType(e.target.value as ReportViolationType | ""))}>
              <option value="">Tất cả</option>
              {VIOLATION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trạng thái" uiSize="xs" className="w-32">
            <Select uiSize="xs" value={status} onChange={(e) => updateFilter(() => setStatus(e.target.value as ReportViolationStatus | ""))}>
              <option value="">Tất cả</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tìm kiếm" uiSize="xs" className="w-40">
            <div className="flex gap-1">
              <Input
                uiSize="xs"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") updateFilter(() => setKeyword(keywordInput));
                }}
                placeholder="Tên nhân viên"
              />
              <Button type="button" variant="outline" size="xs" onClick={() => updateFilter(() => setKeyword(keywordInput))}>
                <Search className="h-3 w-3" strokeWidth={2} />
              </Button>
            </div>
          </Field>
          {hasFilters && (
            <Button type="button" variant="outline" size="xs" onClick={handleClearFilters}>
              <X className="h-3 w-3" strokeWidth={2} />
              Xóa bộ lọc
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {deadline && (
              <span className="text-xs whitespace-nowrap text-slate-500">
                Hạn nộp: {pad2(deadline.hour)}:{pad2(deadline.minute)}
              </span>
            )}
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setDeadlineHour(String(deadline?.hour ?? 22));
                  setDeadlineMinute(String(deadline?.minute ?? 30));
                  setDeadlineError(null);
                  setDeadlineModalOpen(true);
                }}
              >
                <Settings2 className="h-3 w-3" strokeWidth={2} />
                Cài đặt thời hạn báo cáo
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Đang tải...
          </div>
        ) : error ? (
          <p role="alert" className="p-4 text-sm text-red-600">
            {error}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50 text-xs font-semibold tracking-wide text-brand-900 uppercase">
                <tr>
                  <th className="px-4 py-3">STT</th>
                  <th className="px-4 py-3">Ngày báo cáo</th>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Nhóm</th>
                  <th className="px-4 py-3">Hạn nộp</th>
                  <th className="px-4 py-3">Thời gian nộp thực tế</th>
                  <th className="px-4 py-3">Loại vi phạm</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Ghi chú</th>
                  {canManage && <th className="px-4 py-3">Hành động</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((violation, index) => (
                  <tr key={violation.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="px-4 py-2.5 text-slate-700">{formatDateOnly(violation.report_date)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar fullName={violation.account_name} avatarUrl={violation.account_avatar_url} className="h-7 w-7 text-xs" />
                        <span className="font-medium text-slate-800">{violation.account_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{violation.team_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatTime(violation.deadline_snapshot)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{violation.actual_submitted_at ? formatDateTime(violation.actual_submitted_at) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${VIOLATION_TYPE_BADGE[violation.violation_type]}`}>
                        <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                        {VIOLATION_TYPE_LABEL[violation.violation_type]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[violation.status]}`}>
                        {STATUS_LABEL[violation.status]}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-slate-500" title={violation.note ?? undefined}>
                      {violation.note ?? "—"}
                    </td>
                    {canManage && (
                      <td className="px-4 py-2.5">
                        <Button type="button" variant="outline" size="xs" onClick={() => openStatusModal(violation)}>
                          <RotateCcw className="h-3 w-3" strokeWidth={2} />
                          Cập nhật
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-500">Không có vi phạm nào phù hợp bộ lọc</div>
            )}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Trang {page} — hiển thị {items.length} / {total} dòng
        </span>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trước
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>
            Sau
          </Button>
        </div>
      </div>

      {deadlineModalOpen && (
        <Modal
          title="Cài đặt thời hạn báo cáo"
          description="Áp dụng cho các ngày tiếp theo — không ảnh hưởng vi phạm đã ghi nhận trước đó."
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setDeadlineModalOpen(false)}>
                Hủy
              </Button>
              <Button type="button" disabled={deadlineSubmitting} onClick={() => void handleSaveDeadline()}>
                {deadlineSubmitting ? "Đang lưu..." : "Lưu"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Giờ (0-23)">
                <Input value={deadlineHour} onChange={(e) => setDeadlineHour(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Phút (0-59)">
                <Input value={deadlineMinute} onChange={(e) => setDeadlineMinute(e.target.value)} inputMode="numeric" />
              </Field>
            </div>
            {deadlineError && (
              <p role="alert" className="text-sm text-red-600">
                {deadlineError}
              </p>
            )}
          </div>
        </Modal>
      )}

      {statusTarget && (
        <Modal
          title={`Cập nhật vi phạm — ${statusTarget.account_name}`}
          description={`${VIOLATION_TYPE_LABEL[statusTarget.violation_type]} · Ngày báo cáo ${formatDateOnly(statusTarget.report_date)}`}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setStatusTarget(null)}>
                Hủy
              </Button>
              <Button type="button" disabled={statusSubmitting} onClick={() => void handleSaveStatus()}>
                {statusSubmitting ? "Đang lưu..." : "Lưu"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {conflictViolationIds.has(statusTarget.id) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                <span>Dữ liệu này vừa được cập nhật bởi người khác</span>
                <button
                  type="button"
                  className="font-medium underline hover:text-amber-900"
                  onClick={handleReloadConflictedViolation}
                >
                  Tải lại
                </button>
              </div>
            )}
            <Field label="Trạng thái">
              <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value as ReportViolationStatus)}>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ghi chú">
              <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={3} />
            </Field>
            {statusError && (
              <p role="alert" className="text-sm text-red-600">
                {statusError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

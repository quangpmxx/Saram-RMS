"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, MapPin, RotateCcw } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { AccountRole, CheckinListResult, CheckinRecordStatus, CheckinStatusFilter, Team, TeamMember } from "@/lib/types";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

const EMPLOYEE_ROLES = ["leader", "mkt", "sale"];

function todayDateOnly(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const STATUS_FILTER_OPTIONS: Array<{ value: CheckinStatusFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "checked_in", label: "Đã Check in" },
  { value: "not_checked_in", label: "Chưa Check in" },
  { value: "valid", label: "Hợp lệ" },
  { value: "outside_company", label: "Ngoài công ty" },
  { value: "needs_verification", label: "Cần xác minh" },
];

const STATUS_BADGE: Record<CheckinRecordStatus, { label: string; bg: string; text: string }> = {
  valid: { label: "Hợp lệ", bg: "bg-emerald-100", text: "text-emerald-700" },
  outside_company: { label: "Ngoài công ty", bg: "bg-amber-100", text: "text-amber-700" },
  needs_verification: { label: "Cần xác minh", bg: "bg-orange-100", text: "text-orange-700" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface ResetTarget {
  recordId: string;
  fullName: string;
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 3+4,
 * Mục 11: "trang quản lý Check in" — bộ lọc Ngày/Nhóm/Nhân viên/Trạng thái
 * + bảng nhân viên biết ai đã/chưa Check in + (Phase 4) nút Reset CHỈ hiện
 * với Admin. KHÔNG phân trang (yêu cầu trực tiếp người dùng, 2026-07-15:
 * "bỏ luôn cái trang và lựa chọn số dòng này đi, hiện 1 trang thôi vì dù
 * sao cũng chỉ có vài chục nhân viên" — đã thử kiểu trang Đưa đón rồi bỏ
 * lại theo đúng phản hồi này) — hiển thị TOÀN BỘ nhân viên trong phạm vi,
 * chỉ cuộn nội bộ nếu tràn khung nhìn (khối cuộn ghim tiêu đề đo bằng
 * ResizeObserver, kỹ thuật đã chứng minh hoạt động ở shuttle-client.tsx).
 */
export function CheckinManagementPanel({
  canFilterByTeam,
  teams,
  accountOptions,
  currentUserRole,
}: {
  canFilterByTeam: boolean;
  teams: Team[];
  accountOptions: TeamMember[];
  currentUserRole: AccountRole;
}) {
  const toast = useToast();
  const [date, setDate] = useState(todayDateOnly);
  const [teamId, setTeamId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [statusFilter, setStatusFilter] = useState<CheckinStatusFilter>("all");
  const [data, setData] = useState<CheckinListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const isAdmin = currentUserRole === "admin";
  const filteredAccountOptions = accountOptions.filter((a) => EMPLOYEE_ROLES.includes(a.role));

  // Đo chiều cao thật của header hệ thống + thanh bộ lọc bằng ResizeObserver
  // (kỹ thuật đã chứng minh hoạt động ở shuttle-client.tsx) để khối cuộn
  // bảng có chiều cao TÍNH TRỰC TIẾP bằng số, hiển thị tối đa số dòng có
  // thể mà không tràn màn hình.
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(48);
  const [filterHeight, setFilterHeight] = useState(50);

  useEffect(() => {
    const headerEl = document.querySelector("header");
    const filterEl = filterBarRef.current;
    if (!headerEl || !filterEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.getBoundingClientRect().height;
        if (entry.target === headerEl) setHeaderHeight(height);
        else if (entry.target === filterEl) setFilterHeight(height);
      }
    });
    observer.observe(headerEl);
    observer.observe(filterEl);
    return () => observer.disconnect();
  }, []);

  /** Tab "Chấm công thủ công/Check in GPS" (~36px) + margin/border tự viết trong module này — hằng số nhỏ, ổn định. */
  const FIXED_SPACING = 36 + 8 + 12 + 2;
  const tableBoxHeight = `calc(100vh - ${headerHeight + filterHeight + FIXED_SPACING}px)`;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    const params = new URLSearchParams({ date });
    if (teamId) params.set("team_id", teamId);
    if (accountId) params.set("account_id", accountId);
    if (statusFilter !== "all") params.set("status_filter", statusFilter);

    clientApi<CheckinListResult>(`/checkin/records?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Không tải được danh sách Check in");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, teamId, accountId, statusFilter, refreshKey]);

  async function handleConfirmReset() {
    if (!resetTarget) return;
    if (!resetReason.trim()) {
      setResetError("Vui lòng nhập lý do Reset");
      return;
    }
    setResetError(null);
    setResetSubmitting(true);
    try {
      await clientApi(`/checkin/${resetTarget.recordId}/reset`, {
        method: "POST",
        body: JSON.stringify({ reason: resetReason.trim() }),
      });
      toast.success(`Đã Reset Check in của ${resetTarget.fullName}`);
      setResetTarget(null);
      setResetReason("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setResetSubmitting(false);
    }
  }

  const employees = data?.employees ?? [];

  // Nghi vấn gian lận (yêu cầu trực tiếp người dùng, 2026-07-15): "2 tài
  // khoản chấm công đều hiển thị chung 1 IP máy" (nhờ người đến trước Check
  // in hộ) — đếm số nhân viên trùng IP trong danh sách ĐANG HIỂN THỊ (theo
  // đúng bộ lọc ngày/nhóm/nhân viên hiện tại), IP nào >= 2 người thì tô đỏ.
  const ipCounts = new Map<string, number>();
  for (const employee of employees) {
    const ip = employee.checkin?.ip_address;
    if (!ip) continue;
    ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
  }
  function isDuplicateIp(ip: string | null | undefined): boolean {
    return Boolean(ip && (ipCounts.get(ip) ?? 0) >= 2);
  }

  return (
    <div className="space-y-4">
      <div ref={filterBarRef}>
        <Card className="p-2">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Ngày" uiSize="xs" className="w-36">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </Field>
            {canFilterByTeam && (
              <Field label="Nhóm" uiSize="xs" className="w-32">
                <Select uiSize="xs" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">Tất cả nhóm</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Nhân viên" uiSize="xs" className="w-36">
              <Select uiSize="xs" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Tất cả nhân viên</option>
                {filteredAccountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Trạng thái" uiSize="xs" className="w-36">
              <Select uiSize="xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CheckinStatusFilter)}>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      </div>

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
          <div className="overflow-auto" style={{ height: tableBoxHeight }}>
            <table className="w-full text-left text-sm">
              {/* Ghim cố định thanh tiêu đề khi cuộn (yêu cầu trực tiếp
                  người dùng) — nền PHẢI đặc màu (bỏ /60) khi dùng sticky, vì
                  nền trong suốt sẽ lộ nội dung cuộn phía dưới đè lên chữ. */}
              <thead className="sticky top-0 z-10 bg-brand-50 text-xs font-semibold tracking-wide text-brand-900 uppercase shadow-sm">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Nhóm</th>
                  <th className="px-4 py-3">Chức vụ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Giờ Check in</th>
                  <th className="px-4 py-3">Địa chỉ</th>
                  <th className="px-4 py-3">Khoảng cách</th>
                  <th className="px-4 py-3">Địa chỉ IP</th>
                  <th className="px-4 py-3">Thiết bị</th>
                  {isAdmin && <th className="px-4 py-3">Hành động</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((employee) => (
                  <tr key={employee.account_id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar fullName={employee.full_name} avatarUrl={employee.avatar_url} className="h-7 w-7 text-xs" />
                        <span className="font-medium text-slate-800">{employee.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{employee.team_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{employee.position ?? ACCOUNT_ROLE_LABEL[employee.role]}</td>
                    <td className="px-4 py-2.5">
                      {employee.checkin ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[employee.checkin.status].bg} ${STATUS_BADGE[employee.checkin.status].text}`}
                        >
                          {employee.checkin.status === "valid" ? (
                            <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                          ) : (
                            <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                          )}
                          {STATUS_BADGE[employee.checkin.status].label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          <Circle className="h-3 w-3" strokeWidth={2} />
                          Chưa Check in
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{employee.checkin ? formatTime(employee.checkin.checked_in_at) : "—"}</td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-slate-500" title={employee.checkin?.resolved_address ?? undefined}>
                      {employee.checkin?.resolved_address ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {employee.checkin ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                          {Math.round(employee.checkin.distance_from_company_meters)}m
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isDuplicateIp(employee.checkin?.ip_address) ? (
                        <span className="flex items-center gap-1 font-semibold text-red-600" title="Trùng IP với nhân viên khác — nghi vấn Check in hộ">
                          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                          {employee.checkin?.ip_address}
                        </span>
                      ) : (
                        <span className="text-slate-600">{employee.checkin?.ip_address ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {employee.checkin
                        ? [employee.checkin.device, employee.checkin.operating_system, employee.checkin.browser].filter(Boolean).join(" · ") || "—"
                        : "—"}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        {employee.checkin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              setResetTarget({ recordId: employee.checkin!.id, fullName: employee.full_name });
                              setResetReason("");
                              setResetError(null);
                            }}
                          >
                            <RotateCcw className="h-3 w-3" strokeWidth={2} />
                            Reset
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-500">Không có nhân viên nào phù hợp bộ lọc</div>
            )}
          </div>
        )}
      </Card>

      {resetTarget && (
        <Modal
          title={`Reset Check in — ${resetTarget.fullName}`}
          description="Nhân viên sẽ được phép Check in lại trong ngày hôm đó. Bản ghi cũ vẫn được giữ lại làm lịch sử."
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
                Hủy
              </Button>
              <Button type="button" disabled={resetSubmitting} onClick={() => void handleConfirmReset()}>
                {resetSubmitting ? "Đang Reset..." : "Xác nhận Reset"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label="Lý do Reset (bắt buộc)">
              <Textarea value={resetReason} onChange={(e) => setResetReason(e.target.value)} rows={3} autoFocus />
            </Field>
            {resetError && (
              <p role="alert" className="text-sm text-red-600">
                {resetError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

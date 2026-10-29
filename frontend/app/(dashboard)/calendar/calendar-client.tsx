"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, CalendarDays, Search, Trash2 } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type {
  AccountRole,
  CalendarEvent,
  Candidate,
  ModulePermissionLevel,
  PaginatedResult,
  TeamMember,
} from "@/lib/types";
import { NameWithRoleHint } from "@/components/name-with-role-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/form";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Modal } from "@/components/ui/modal";
import { ViewOnlyBadge } from "@/components/ui/view-only-badge";
import { type DateRangeValue } from "@/lib/date-range";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

function formatDateHeader(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupByDate(events: CalendarEvent[]): Array<{ dateKey: string; events: CalendarEvent[] }> {
  const sorted = [...events].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of sorted) {
    const dateKey = event.scheduled_at.slice(0, 10);
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(event);
    groups.set(dateKey, bucket);
  }
  return [...groups.entries()].map(([dateKey, items]) => ({ dateKey, events: items }));
}

/**
 * Mục 7, docs/12-ui-design.md: chế độ xem agenda (danh sách) — không dựng
 * lưới lịch tháng/tuần đầy đủ để giữ đúng design system hiện tại (bảng/thẻ),
 * tài liệu cho phép "Danh sách agenda" là 1 trong 2 chế độ xem hợp lệ.
 */
export function CalendarClient({
  permissionLevel,
  initialEvents,
  initialDateFrom,
  initialDateTo,
  canFilterBySale,
  saleMembers,
  currentUserId,
  currentUserRole,
}: {
  permissionLevel: ModulePermissionLevel;
  initialEvents: CalendarEvent[];
  initialDateFrom: string;
  initialDateTo: string;
  /** Dự án phụ — nâng cấp toàn diện: chỉ Admin/Quản lý/Leader mới cần chọn Sale (Sale role đã bị khóa chỉ thấy lịch của mình). */
  canFilterBySale: boolean;
  saleMembers: TeamMember[];
  currentUserId: string;
  currentUserRole: AccountRole;
}) {
  useSetPageTitle("Lịch hẹn");
  const [events, setEvents] = useState(initialEvents);
  /**
   * Dự án phụ — nâng cấp toàn diện: bộ lọc ngày kiểu Google Analytics dùng
   * chung (xem components/ui/date-range-picker.tsx). Trang này trước đây
   * không có khái niệm preset, chỉ có 2 ô ngày rời — mặc định server
   * (page.tsx: hôm nay - 7 đến hôm nay + 30) không khớp preset nào có sẵn
   * nên giữ nguyên dạng "custom" như cũ, không đổi hành vi mặc định.
   */
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    preset: "custom",
    from: initialDateFrom,
    to: initialDateTo,
  });
  /** Dự án phụ — nâng cấp toàn diện (2026-07-14, yêu cầu trực tiếp người dùng): lọc theo Sale ĐÃ HẸN + loại lịch (Phỏng vấn/Gọi lại). */
  const [createdById, setCreatedById] = useState("");
  const [eventType, setEventType] = useState<"" | "interview" | "callback">("");
  const toast = useToast();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const groups = groupByDate(events);

  async function refresh() {
    const query = new URLSearchParams({ date_from: dateRange.from, date_to: dateRange.to });
    if (createdById) query.set("created_by_id", createdById);
    if (eventType) query.set("type", eventType);
    const result = await clientApi<CalendarEvent[]>(`/calendar?${query.toString()}`);
    setEvents(result);
  }

  const isReadOnly = permissionLevel === "view";
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  /**
   * Nút xoá trên từng dòng (yêu cầu người dùng 2026-10-29) — khớp quyền
   * backend: MKT chỉ xem; Sale chỉ xoá lịch gọi lại do chính mình đặt (lịch
   * PV theo phạm vi lead, backend kiểm tra lại). Xoá mềm — vẫn còn trong
   * lịch sử thao tác của data.
   */
  function canDelete(event: CalendarEvent): boolean {
    if (isReadOnly || currentUserRole === "mkt") return false;
    if (currentUserRole === "sale" && event.type === "callback") return event.created_by.id === currentUserId;
    return true;
  }

  async function handleDelete(event: CalendarEvent) {
    const label = event.type === "interview" ? "lịch hẹn phỏng vấn" : "lịch gọi lại";
    if (
      !window.confirm(
        `Xoá ${label} của ${event.candidate.full_name} lúc ${formatDateTime(event.scheduled_at)}?`,
      )
    ) {
      return;
    }
    const key = `${event.type}-${event.id}`;
    setDeletingKey(key);
    try {
      await clientApi(`/calendar/${event.type}/${event.id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => !(e.type === event.type && e.id === event.id)));
      toast.success(`Đã xoá ${label}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {isReadOnly && (
        <div className="mb-3">
          <ViewOnlyBadge />
        </div>
      )}
      <div className="mb-4 flex justify-end">
        <Button type="button" disabled={isReadOnly} onClick={() => setIsScheduleModalOpen(true)}>
          <CalendarPlus className="h-4 w-4" strokeWidth={2} />
          Đặt lịch hẹn PV mới
        </Button>
      </div>

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Khoảng thời gian" className="w-44">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </Field>
        {canFilterBySale && (
          <Field label="Nhân viên" className="w-44">
            <Select value={createdById} onChange={(event) => setCreatedById(event.target.value)}>
              <option value="">Tất cả nhân viên</option>
              {saleMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Loại lịch" className="w-40">
          <Select value={eventType} onChange={(event) => setEventType(event.target.value as "" | "interview" | "callback")}>
            <option value="">Tất cả</option>
            <option value="interview">Phỏng vấn</option>
            <option value="callback">Gọi lại</option>
          </Select>
        </Field>
        <Button type="button" variant="outline" onClick={() => void refresh()}>
          <Search className="h-4 w-4" strokeWidth={2} />
          Lọc
        </Button>
      </Card>

      {groups.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            title="Không có lịch hẹn nào trong khoảng thời gian này"
            icon={<CalendarDays className="h-5 w-5" strokeWidth={1.75} />}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <Card key={group.dateKey} className="overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {formatDateHeader(group.events[0].scheduled_at)}
              </div>
              <ul className="divide-y divide-slate-100">
                {group.events.map((event) => (
                  <li key={`${event.type}-${event.id}`} className="flex items-center transition-colors hover:bg-slate-50">
                    <Link
                      href={`/candidates/${event.candidate.id}`}
                      className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={event.type === "interview" ? "info" : "accent"}>
                          {event.type === "interview" ? "Phỏng vấn" : "Gọi lại"}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{event.candidate.full_name}</p>
                          <p className="text-xs text-slate-500">{event.candidate.phone_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">{formatDateTime(event.scheduled_at)}</p>
                        <p className="text-xs text-slate-400">
                          Sale hẹn: <NameWithRoleHint account={event.created_by} className="font-medium text-slate-500" />
                        </p>
                      </div>
                    </Link>
                    {canDelete(event) && (
                      <button
                        type="button"
                        title="Xoá lịch hẹn"
                        aria-label={`Xoá lịch hẹn của ${event.candidate.full_name}`}
                        disabled={deletingKey === `${event.type}-${event.id}`}
                        onClick={() => void handleDelete(event)}
                        className="mr-3 shrink-0 rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {isScheduleModalOpen && (
        <ScheduleInterviewQuickModal
          onClose={() => setIsScheduleModalOpen(false)}
          onCreated={async () => {
            setIsScheduleModalOpen(false);
            await refresh();
            toast.success("Đã đặt lịch hẹn phỏng vấn");
          }}
        />
      )}
    </div>
  );
}

function ScheduleInterviewQuickModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [partnerCompanyName, setPartnerCompanyName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSearch() {
    if (!keyword.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const query = new URLSearchParams({ keyword, page: "1", page_size: "10" });
      const result = await clientApi<PaginatedResult<Candidate>>(`/candidate?${query.toString()}`);
      setResults(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit() {
    if (!selected) {
      setError("Vui lòng chọn lao động");
      return;
    }
    if (!partnerCompanyName.trim() || !scheduledAt) {
      setError("Vui lòng nhập đầy đủ công ty đối tác và ngày giờ hẹn");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await clientApi(`/candidate/${selected.id}/interview`, {
        method: "POST",
        body: JSON.stringify({
          partner_company_name: partnerCompanyName,
          scheduled_at: new Date(scheduledAt).toISOString(),
        }),
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title="Đặt lịch hẹn phỏng vấn mới"
      description="Tìm lao động rồi nhập thông tin lịch hẹn — giống popup tại trang Chi tiết lao động."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting || !selected} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Đặt lịch"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Tìm lao động (tên/SĐT)">
          <div className="flex gap-2">
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
              placeholder="Nhập tên hoặc số điện thoại"
              autoFocus
            />
            <Button type="button" variant="outline" disabled={isSearching} onClick={() => void handleSearch()}>
              <Search className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </Field>

        {results.length > 0 && (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1">
            {results.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(candidate);
                    setResults([]);
                    setKeyword(`${candidate.full_name} · ${candidate.phone_number}`);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  <span className="font-medium">{candidate.full_name}</span>
                  <span className="text-slate-400"> · {candidate.phone_number}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <>
            <Field label="Công ty đối tác (nhà máy) hẹn PV">
              <Input
                value={partnerCompanyName}
                onChange={(event) => setPartnerCompanyName(event.target.value)}
                placeholder="Nhập tên công ty đối tác"
              />
            </Field>
            <Field label="Ngày giờ hẹn">
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </Field>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

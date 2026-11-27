"use client";

import { useCan } from "@/lib/capability-context";
import { useRememberedFilters } from "@/lib/remembered-filters";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarPlus, CalendarDays, Search, Trash2 } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
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

/** "HH:mm" giờ máy — ngày đã có ở tiêu đề nhóm. */
function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

function formatDateHeader(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupByDate(events: CalendarEvent[]): Array<{ dateKey: string; events: CalendarEvent[] }> {
  // Mới nhất lên đầu, cũ nhất ở dưới (2026-11-27, yêu cầu người dùng) — cả nhóm ngày lẫn trong ngày.
  const sorted = [...events].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of sorted) {
    // Ngày theo giờ VN (trước lấy ngày UTC → lịch 0h–7h sáng bị xếp sang hôm trước).
    const dateKey = new Date(event.scheduled_at).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
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
  useSetPageTitle("Lịch gọi lại");
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

  const refreshSeqRef = useRef(0);
  async function refresh() {
    // Bỏ kết quả của lượt tải cũ về muộn (đổi bộ lọc liên tục).
    const seq = ++refreshSeqRef.current;
    const query = new URLSearchParams({ date_from: dateRange.from, date_to: dateRange.to });
    if (createdById) query.set("created_by_id", createdById);
    if (eventType) query.set("type", eventType);
    const result = await clientApi<CalendarEvent[]>(`/calendar?${query.toString()}`);
    if (seq === refreshSeqRef.current) setEvents(result);
  }

  // Đổi bộ lọc là lọc luôn, không cần bấm "Lọc" (yêu cầu người dùng 2026-10-30). Lần đầu mở trang
  // cũng tải lại (2026-11-27): bấm "Quay lại" từ trang data, trình duyệt dùng lại bản cũ đã lưu nên
  // lịch vừa đặt không hiện. Quay lại tab cũng tải lại.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh dùng bộ lọc mới nhất mỗi lần gọi
  }, [dateRange, createdById, eventType]);
  useEffect(() => {
    refresh().catch((error) => toast.error(error instanceof ApiError ? error.message : "Không tải được lịch hẹn"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi bộ lọc đổi
  }, [dateRange, createdById, eventType]);

  // Ghi nhớ bộ lọc khi rời trang rồi quay lại (2026-11-10); đổi state là tự tải lại ở effect trên.
  useRememberedFilters("calendar", { dateRange, createdById, eventType }, (saved) => {
    setDateRange(saved.dateRange);
    setCreatedById(saved.createdById);
    setEventType(saved.eventType);
  });

  const isReadOnly = permissionLevel === "view";
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  /**
   * Nút xoá trên từng dòng (yêu cầu người dùng 2026-10-29) — khớp quyền
   * backend (lead-pipeline.service.ts): cần quyền xử lý data; chỉ có "xử lý
   * hộ" (mặc định Sale) thì chỉ xoá lịch gọi lại do chính mình đặt (lịch PV
   * theo phạm vi lead, backend kiểm tra lại). Xoá mềm — vẫn còn trong lịch
   * sử thao tác của data.
   */
  const can = useCan();
  const canProcessAny = can("lead.process_all") || can("lead.edit_team");
  const canProcessOwn = canProcessAny || can("lead.edit_help") || currentUserRole !== "mkt";
  function canDelete(event: CalendarEvent): boolean {
    if (isReadOnly || !canProcessOwn) return false;
    if (!canProcessAny && event.type === "callback") return event.created_by.id === currentUserId;
    return true;
  }

  async function handleDelete(event: CalendarEvent) {
    const label = event.type === "interview" ? "lịch hẹn phỏng vấn" : "lịch gọi lại";
    const question = event.repeat_daily
      ? `Xoá lịch gọi lại MỖI NGÀY của ${event.candidate.full_name}? Tất cả các ngày của lịch này sẽ bị xoá.`
      : `Xoá ${label} của ${event.candidate.full_name} lúc ${formatDateTime(event.scheduled_at)}?`;
    if (!window.confirm(question)) {
      return;
    }
    const key = `${event.type}-${event.id}`;
    setDeletingKey(key);
    try {
      await clientApi(`/calendar/${event.type}/${event.id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => !(e.type === event.type && e.id === event.id)));
      // Admin/Quản lý vẫn thấy lịch đã xoá (ghi "Đã xoá") → tải lại để hiện đúng.
      void refresh().catch(() => undefined);
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
      <div className="mb-2 flex justify-end">
        <Button type="button" size="xs" disabled={isReadOnly} onClick={() => setIsScheduleModalOpen(true)}>
          <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
          Đặt lịch hẹn PV mới
        </Button>
      </div>

      <Card className="mb-4 flex flex-wrap items-end gap-2 p-3">
        <Field uiSize="xs" label="Khoảng thời gian" className="w-44">
          <DateRangePicker value={dateRange} onChange={setDateRange} className="h-7" />
        </Field>
        {canFilterBySale && (
          <Field uiSize="xs" label="Nhân viên" className="w-44">
            <Select uiSize="xs" className="h-7" value={createdById} onChange={(event) => setCreatedById(event.target.value)}>
              <option value="">Tất cả nhân viên</option>
              {saleMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field uiSize="xs" label="Loại lịch" className="w-36">
          <Select uiSize="xs" className="h-7" value={eventType} onChange={(event) => setEventType(event.target.value as "" | "interview" | "callback")}>
            <option value="">Tất cả</option>
            <option value="interview">Phỏng vấn</option>
            <option value="callback">Gọi lại</option>
          </Select>
        </Field>
        <Button type="button" size="xs" variant="secondary" className="h-7" onClick={() => void refresh()}>
          <Search className="h-3.5 w-3.5" strokeWidth={2} />
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
              {/* Dạng bảng (2026-11-27, yêu cầu người dùng): mỗi lịch 1 dòng, các ý chia cột. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="px-4 py-2 font-medium">Data</th>
                      <th className="px-4 py-2 font-medium">Hẹn lúc</th>
                      <th className="px-4 py-2 font-medium">Trạng thái</th>
                      <th className="px-4 py-2 font-medium">Sale hẹn</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.events.map((event) => (
                      <tr
                        key={`${event.type}-${event.id}-${event.scheduled_at}`}
                        className={cn("transition-colors hover:bg-slate-50", event.deleted && "bg-red-50/40")}
                      >
                        <td className="px-4 py-2.5">
                          <Link href={`/candidates/${event.candidate.id}`} className="block">
                            <span className="font-medium text-slate-800 hover:text-brand-600">{event.candidate.full_name}</span>
                            <span className="block text-xs text-slate-500">{event.candidate.phone_number}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{formatTime(event.scheduled_at)}</span>
                          <span className="ml-2 inline-flex gap-1 align-middle">
                            <Badge variant={event.type === "interview" ? "info" : "accent"}>
                              {event.type === "interview" ? "Phỏng vấn" : "Gọi lại"}
                            </Badge>
                            {event.repeat_daily && <Badge variant="neutral">Mỗi ngày</Badge>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {event.type === "callback" ? <CallbackStatus event={event} /> : <span className="text-xs text-slate-400">—</span>}
                          {event.deleted && (
                            <span className="mt-0.5 block text-xs font-medium text-red-700">
                              🗑 Đã xoá {formatDateTime(event.deleted.at)}
                              {event.deleted.by ? ` · ${event.deleted.by}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">
                          <NameWithRoleHint account={event.created_by} className="font-medium text-slate-600" />
                        </td>
                        <td className="pr-2">
                          {canDelete(event) && !event.deleted && (
                            <button
                              type="button"
                              title="Xoá lịch hẹn"
                              aria-label={`Xoá lịch hẹn của ${event.candidate.full_name}`}
                              disabled={deletingKey === `${event.type}-${event.id}`}
                              onClick={() => void handleDelete(event)}
                              className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={2} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

/**
 * Trạng thái lịch gọi lại (2026-11-27, yêu cầu người dùng): có ghi chú trong 30 phút kể từ giờ hẹn
 * (lúc phần mềm báo nhắc) = "Đã gọi lại"; quá 30 phút chưa có = "Chưa gọi lại"; trong 30 phút = "Đang tới giờ gọi".
 */
function CallbackStatus({ event }: { event: CalendarEvent }) {
  if (event.called_back) {
    return (
      <span className="text-xs font-medium text-emerald-600">
        ✓ Đã gọi lại lúc {formatTime(event.called_back.at)}
        <span className="block font-normal text-slate-500">{event.called_back.by}</span>
      </span>
    );
  }
  if (event.callback_state === "missed") return <span className="text-xs font-medium text-red-600">✗ Chưa gọi lại</span>;
  if (event.callback_state === "due") return <span className="text-xs font-medium text-amber-600">Đang tới giờ gọi</span>;
  return <span className="text-xs text-slate-400">Chưa tới giờ</span>;
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

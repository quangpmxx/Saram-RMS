"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, CalendarDays, Search } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { CalendarEvent, Candidate, PaginatedResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { type DateRangeValue } from "@/lib/date-range";
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
  initialEvents,
  initialDateFrom,
  initialDateTo,
}: {
  initialEvents: CalendarEvent[];
  initialDateFrom: string;
  initialDateTo: string;
}) {
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
  const toast = useToast();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const groups = groupByDate(events);

  async function refresh() {
    const query = new URLSearchParams({ date_from: dateRange.from, date_to: dateRange.to });
    const result = await clientApi<CalendarEvent[]>(`/calendar?${query.toString()}`);
    setEvents(result);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Lịch hẹn"
        description="Lịch hẹn phỏng vấn và lịch gọi lại — theo phạm vi quyền của bạn."
        actions={
          <Button type="button" onClick={() => setIsScheduleModalOpen(true)}>
            <CalendarPlus className="h-4 w-4" strokeWidth={2} />
            Đặt lịch hẹn PV mới
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Khoảng thời gian" className="w-44">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
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
                  <li key={`${event.type}-${event.id}`}>
                    <Link
                      href={`/candidates/${event.candidate.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 p-4 transition-colors hover:bg-slate-50"
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
                      <span className="text-sm text-slate-600">{formatDateTime(event.scheduled_at)}</span>
                    </Link>
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

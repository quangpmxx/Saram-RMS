"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import type { AnonymousFeedback, AppRealtimeEvent } from "@/lib/types";
import { useAppRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { SortableTh, sortRows, type SortState } from "@/components/ui/sortable-th";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { EMPTY_DATE_RANGE, type DateRangeValue } from "@/lib/date-range";
import { useToast } from "@/lib/toast-context";
import { apiErrorMessage } from "./leave-request-client";
import { AnonymousFeedbackPaper, vnDateOnly } from "./anonymous-feedback-paper";

function buildQuery(date: DateRangeValue): string {
  const query = new URLSearchParams();
  if (date.from) query.set("date_from", new Date(date.from).toISOString());
  if (date.to) query.set("date_to", new Date(`${date.to}T23:59:59.999`).toISOString());
  return query.toString();
}

/**
 * Đơn phản ánh ẩn danh (2026-10-28) — danh sách cho Quản lý/Admin, chỉ đọc
 * (đã chốt: không trạng thái/ghi chú xử lý). Không có cột người gửi — API
 * không trả thông tin này. Tự tải lại khi có thông báo đơn mới (realtime).
 */
export function AnonymousFeedbackList() {
  const toast = useToast();
  const [items, setItems] = useState<AnonymousFeedback[] | null>(null);
  const [dateFilter, setDateFilter] = useState<DateRangeValue>(EMPTY_DATE_RANGE);
  const [openItem, setOpenItem] = useState<AnonymousFeedback | null>(null);
  // Bấm tiêu đề "Ngày gửi" để đổi chiều (yêu cầu người dùng 2026-10-30).
  const [sort, setSort] = useState<SortState<"created_at">>({ key: "created_at", order: "desc" });
  const rows = sortRows(items ?? [], sort.order, (item) => item.created_at);

  const load = useCallback(
    (date: DateRangeValue, silent = false) =>
      clientApi<AnonymousFeedback[]>(`/anonymous-feedback?${buildQuery(date)}`)
        .then(setItems)
        .catch((err: unknown) => {
          if (!silent) toast.error(apiErrorMessage(err));
        }),
    [toast],
  );

  useEffect(() => {
    void load(dateFilter);
  }, [load, dateFilter]);

  useAppRealtime((event: AppRealtimeEvent) => {
    const payload = event.payload as { type?: string } | undefined;
    if (event.module === "notification" && payload?.type === "anonymous_feedback_created") {
      void load(dateFilter, true);
    }
  });
  useRealtimeReconnect(() => void load(dateFilter, true));

  return (
    <div>
      <Card className="mb-3 p-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Field label="Ngày gửi" uiSize="xs" className="w-40">
            <DateRangePicker value={dateFilter} onChange={setDateFilter} placeholder="Tất cả" allowClear />
          </Field>
          <p className="text-xs text-slate-500">Đơn ẩn danh — hệ thống không hiển thị người gửi.</p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/60 text-xs font-semibold tracking-wide text-brand-900 uppercase">
              <tr>
                <SortableTh sortKey="created_at" sort={sort} onSort={setSort} className="px-4 py-3">
                  Ngày gửi
                </SortableTh>
                <th className="px-4 py-3">Tiêu đề</th>
                <th className="px-4 py-3">Nội dung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => setOpenItem(item)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {new Date(item.created_at).toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="max-w-[280px] truncate px-4 py-3 font-medium text-slate-800" title={item.subject}>
                    {item.subject}
                  </td>
                  <td className="max-w-[320px] truncate px-4 py-3 text-slate-500" title={item.content}>
                    {item.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items !== null && items.length === 0 && (
          <EmptyState
            title="Chưa có đơn phản ánh nào"
            icon={<MessageSquareWarning className="h-5 w-5" strokeWidth={1.75} />}
          />
        )}
        {items === null && <p className="p-6 text-center text-sm text-slate-400">Đang tải…</p>}
      </Card>

      {openItem && (
        <Modal
          title="Đơn phản ánh ẩn danh"
          maxWidth="max-w-3xl"
          footer={
            <Button type="button" onClick={() => setOpenItem(null)}>
              Đóng
            </Button>
          }
        >
          <AnonymousFeedbackPaper
            date={vnDateOnly(openItem.created_at)}
            subjectSlot={<span className="font-medium">{openItem.subject}</span>}
            contentSlot={<p className="leading-7 break-words whitespace-pre-wrap">{openItem.content}</p>}
          />
        </Modal>
      )}
    </div>
  );
}

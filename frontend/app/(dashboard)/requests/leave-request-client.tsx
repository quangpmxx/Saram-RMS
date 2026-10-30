"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilePlus2, MessageSquareWarning } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { Account, LeaveRequest, LeaveRequestStatus } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/form";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SortableTh, sortRows, type SortState } from "@/components/ui/sortable-th";
import { EMPTY_DATE_RANGE, type DateRangeValue } from "@/lib/date-range";
import { useToast } from "@/lib/toast-context";
import { CreateLeaveRequestModal } from "./create-leave-request-modal";
import { LeaveRequestDetailModal } from "./leave-request-detail-modal";
import { CreateAnonymousFeedbackModal } from "./create-anonymous-feedback-modal";
import { AnonymousFeedbackList } from "./anonymous-feedback-list";

/**
 * Khớp CREATE_ROLES ở backend (leave-requests.service.ts). Yêu cầu trực
 * tiếp người dùng (2026-07-16): "Leader cũng cần có tính năng tạo đơn nghỉ
 * phép, sau khi gửi có thể tự duyệt" — Leader tạo đơn cho CHÍNH MÌNH thì
 * chính họ là "Leader phụ trách" của đơn đó (Team.leaderId === chính họ),
 * nên tự nhiên tự duyệt được bước của mình ở LeaveRequestDetailModal, không
 * cần cơ chế riêng. KHÁC user-menu.tsx (CREATE_REQUEST_ROLES chỉ mkt/sale
 * — nút "Tạo đơn" ở đó là điểm vào chung cho NHIỀU loại đơn tương lai,
 * không phải chỉ riêng đơn nghỉ phép) — Leader vào thẳng trang này qua
 * sidebar, không qua nút "Tạo đơn" đó.
 */
const CREATE_ROLES = ["mkt", "sale", "leader"];
/**
 * Đơn phản ánh ẩn danh (2026-10-28): Quản lý/Admin xem (chỉ đọc), MỌI vai trò
 * còn lại gửi — khớp VIEW_ROLES ở anonymous-feedback.service.ts.
 */
const FEEDBACK_VIEW_ROLES = ["admin", "manager"];

const STATUS_FILTER_OPTIONS: Array<{ value: LeaveRequestStatus | "all"; label: string }> = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "pending_leader", label: "Chờ Leader duyệt" },
  { value: "pending_admin", label: "Chờ Admin duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
];

export const STATUS_BADGE: Record<LeaveRequestStatus, { label: string; variant: "warning" | "success" | "danger" }> = {
  pending_leader: { label: "Chờ Leader duyệt", variant: "warning" },
  pending_admin: { label: "Chờ Admin duyệt", variant: "warning" },
  approved: { label: "Đã duyệt", variant: "success" },
  rejected: { label: "Đã từ chối", variant: "danger" },
};

export function formatDateOnly(value: string): string {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16, module "Tạo đơn"): trang "Đơn
 * xin nghỉ phép" — nội dung/quyền hành động tự đổi theo vai trò đăng nhập:
 * - Sale/MKT: tạo đơn mới + xem lịch sử đơn của chính mình.
 * - Leader: tạo đơn cho CHÍNH MÌNH (tự duyệt bước Leader) + duyệt đơn của
 *   thành viên nhóm mình.
 * - Admin: xem + duyệt bước cuối (sau khi qua Leader, hoặc thẳng nếu nhân
 *   viên không có Leader).
 * - Quản lý: chỉ xem toàn bộ, không có nút duyệt (đúng nguyên văn yêu cầu
 *   "leader duyệt xong... chuyển cho admin duyệt tiếp" — không nhắc Quản lý).
 * Bấm vào 1 dòng mở popup dạng "tờ đơn" (LeaveRequestDetailModal) — y hệt
 * mẫu giấy đính kèm, kèm nút Duyệt/Từ chối nếu người xem có quyền ở đúng
 * bước hiện tại. `?open=<id>` (từ thông báo bấm vào) tự mở đúng đơn đó.
 * Bộ lọc Trạng thái + Ngày gửi (yêu cầu trực tiếp người dùng, 2026-07-16)
 * — "Ngày gửi" lọc theo `created_at`, khớp đúng quy ước DateRangePicker đã
 * dùng ở trang Data lao động (lọc `uploaded_at`), không phát minh quy ước
 * ngày mới.
 */
export function LeaveRequestClient({
  currentUser,
  initialRequests,
}: {
  currentUser: Account;
  initialRequests: LeaveRequest[];
}) {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [requests, setRequests] = useState(initialRequests);
  // Bấm tiêu đề "Thời gian nghỉ"/"Ngày gửi" (yêu cầu người dùng 2026-10-30).
  const [sort, setSort] = useState<SortState<"start_date" | "created_at">>({ key: "created_at", order: "desc" });
  const sortedRequests = sortRows(requests, sort.order, (request) => request[sort.key]);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateRangeValue>(EMPTY_DATE_RANGE);
  // Không khởi tạo trực tiếp từ searchParams (KHÁC useState(searchParams.get("open")))
  // — Modal dùng createPortal(..., document.body), nếu mở ngay từ lần render
  // ĐẦU TIÊN (bao gồm cả lượt SSR trên server, nơi KHÔNG có `document`) sẽ
  // vỡ trang ("document is not defined"). Dời việc đọc query param sang
  // effect (chỉ chạy ở trình duyệt, sau khi đã mount) để giữ SSR/hydrate
  // ban đầu luôn khớp nhau (null), rồi mới tự mở đúng đơn được nhắc tới.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showFeedbackCreate, setShowFeedbackCreate] = useState(false);
  /** Quản lý/Admin: xem "Đơn nghỉ phép" hay "Phản ánh ẩn danh" (?view=feedback từ thông báo). */
  const [view, setView] = useState<"leave" | "feedback">("leave");

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    queueMicrotask(() => setDetailId(openId));
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("view") !== "feedback") return;
    queueMicrotask(() => setView("feedback"));
  }, [searchParams]);

  const canCreate = CREATE_ROLES.includes(currentUser.role);
  const canViewFeedback = FEEDBACK_VIEW_ROLES.includes(currentUser.role);
  const canSendFeedback = !canViewFeedback;
  const isLeader = currentUser.role === "leader";
  const isAdmin = currentUser.role === "admin" || currentUser.role === "manager";
  // Sale/MKT chỉ bao giờ thấy đúng đơn của chính mình (1 người) — các vai
  // trò còn lại (kể cả Leader, nay đã thấy CẢ đơn của chính mình LẪN đơn
  // thành viên nhóm) đều có thể thấy đơn của nhiều người khác nhau cùng lúc.
  const showEmployeeColumn = currentUser.role !== "sale" && currentUser.role !== "mkt";

  const introText = isLeader
    ? "Tạo đơn xin nghỉ phép cho bản thân, hoặc duyệt đơn của thành viên trong nhóm bạn."
    : canCreate
      ? "Xem lịch sử đơn của bạn hoặc tạo đơn mới."
      : isAdmin
        ? "Duyệt đơn xin nghỉ phép (bước cuối cùng)."
        : "Xem toàn bộ đơn xin nghỉ phép trong hệ thống.";

  async function refresh(nextStatus = statusFilter, nextDate = dateFilter) {
    try {
      const query = new URLSearchParams();
      if (nextStatus !== "all") query.set("status_filter", nextStatus);
      if (nextDate.from) query.set("date_from", new Date(nextDate.from).toISOString());
      if (nextDate.to) query.set("date_to", new Date(`${nextDate.to}T23:59:59.999`).toISOString());
      const result = await clientApi<LeaveRequest[]>(`/leave-request?${query.toString()}`);
      setRequests(result);
    } catch (err) {
      // Báo lỗi thay vì im lặng — đổi bộ lọc mà tải lỗi thì danh sách cũ vẫn
      // hiện như đã lọc xong (rà soát 2026-10-30).
      toast.error(apiErrorMessage(err));
    }
  }

  const detailRequest = requests.find((r) => r.id === detailId) ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {canViewFeedback ? (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            {(["leave", "feedback"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  view === v ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {v === "leave" ? "Đơn xin nghỉ phép" : "Phản ánh ẩn danh"}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{introText}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {canSendFeedback && (
            <Button type="button" variant="outline" onClick={() => setShowFeedbackCreate(true)}>
              <MessageSquareWarning className="h-4 w-4" strokeWidth={2} />
              Gửi phản ánh ẩn danh
            </Button>
          )}
          {canCreate && (
            <Button type="button" onClick={() => setShowCreate(true)}>
              <FilePlus2 className="h-4 w-4" strokeWidth={2.5} />
              Tạo đơn xin nghỉ phép
            </Button>
          )}
        </div>
      </div>

      {showFeedbackCreate && (
        <CreateAnonymousFeedbackModal
          onClose={() => setShowFeedbackCreate(false)}
          onCreated={() => {
            setShowFeedbackCreate(false);
            toast.success("Đã gửi đơn phản ánh ẩn danh");
          }}
        />
      )}

      {view === "feedback" && canViewFeedback ? (
        <AnonymousFeedbackList />
      ) : (
      <>
      {canViewFeedback && <p className="mb-3 text-sm text-slate-500">{introText}</p>}

      <Card className="mb-3 p-2">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Trạng thái" uiSize="xs" className="w-40">
            <Select
              uiSize="xs"
              value={statusFilter}
              onChange={(event) => {
                const next = event.target.value as LeaveRequestStatus | "all";
                setStatusFilter(next);
                void refresh(next, dateFilter);
              }}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngày gửi" uiSize="xs" className="w-40">
            <DateRangePicker
              value={dateFilter}
              onChange={(next) => {
                setDateFilter(next);
                void refresh(statusFilter, next);
              }}
              placeholder="Tất cả"
              allowClear
            />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/60 text-xs font-semibold tracking-wide text-brand-900 uppercase">
              <tr>
                {showEmployeeColumn && <th className="px-4 py-3">Nhân viên</th>}
                <SortableTh sortKey="start_date" sort={sort} onSort={setSort} className="px-4 py-3">
                  Thời gian nghỉ
                </SortableTh>
                <th className="px-4 py-3">Số ngày</th>
                <th className="px-4 py-3">Lý do</th>
                <th className="px-4 py-3">Trạng thái</th>
                <SortableTh sortKey="created_at" sort={sort} onSort={setSort} className="px-4 py-3">
                  Ngày gửi
                </SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRequests.map((request) => (
                <tr
                  key={request.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => setDetailId(request.id)}
                >
                  {showEmployeeColumn && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar fullName={request.account.full_name} avatarUrl={request.account.avatar_url} className="h-6 w-6 text-[10px]" />
                        <span className="font-medium text-slate-800">{request.account.full_name}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateOnly(request.start_date)} — {formatDateOnly(request.end_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{request.days_count} ngày</td>
                  <td className="max-w-[280px] truncate px-4 py-3 text-slate-500" title={request.reason}>
                    {request.reason}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[request.status].variant}>{STATUS_BADGE[request.status].label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(request.created_at).toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {requests.length === 0 && (
          <EmptyState
            title="Chưa có đơn xin nghỉ phép nào"
            description={canCreate ? "Bấm \"Tạo đơn xin nghỉ phép\" để gửi đơn đầu tiên." : undefined}
          />
        )}
      </Card>
      </>
      )}

      {showCreate && (
        <CreateLeaveRequestModal
          currentUser={currentUser}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await refresh();
            toast.success("Đã gửi đơn xin nghỉ phép");
          }}
        />
      )}

      {detailRequest && (
        <LeaveRequestDetailModal
          request={detailRequest}
          currentUser={currentUser}
          onClose={() => setDetailId(null)}
          onDecided={async (message) => {
            setDetailId(null);
            await refresh();
            toast.success(message);
          }}
          onError={(message) => toast.error(message)}
        />
      )}
    </div>
  );
}

export function apiErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Có lỗi xảy ra, vui lòng thử lại";
}

"use client";

import { useState } from "react";
import { Check, X as XIcon } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import type { Account, LeaveRequest } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiErrorMessage, formatDateOnly, STATUS_BADGE } from "./leave-request-client";
import { LeaveRequestPaper } from "./leave-request-paper";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

/** Ô ghi chú + 2 nút Duyệt/Từ chối — đặt ngay tại ô "Xác nhận" đang chờ người xem hiện tại xử lý. */
function DecisionActions({
  note,
  onNoteChange,
  isSubmitting,
  onDecide,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  isSubmitting: boolean;
  onDecide: (decision: "approved" | "rejected") => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Ghi chú (không bắt buộc, nên có nếu từ chối)"
        rows={2}
        className="w-full resize-y rounded border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-brand-500"
      />
      <div className="flex gap-1.5">
        <Button type="button" size="xs" disabled={isSubmitting} onClick={() => onDecide("approved")}>
          <Check className="h-3 w-3" strokeWidth={2.5} />
          Duyệt
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="text-red-600 hover:bg-red-50"
          disabled={isSubmitting}
          onClick={() => onDecide("rejected")}
        >
          <XIcon className="h-3 w-3" strokeWidth={2.5} />
          Từ chối
        </Button>
      </div>
    </div>
  );
}

/** Kết quả đã duyệt/từ chối — hiện huy hiệu + người xử lý + thời gian + ghi chú (nếu có). */
function DecisionResult({
  decision,
  decisionBy,
  decisionAt,
  decisionNote,
}: {
  decision: LeaveRequest["leader_decision"];
  decisionBy: LeaveRequest["leader_decision_by"];
  decisionAt: string | null;
  decisionNote: string | null;
}) {
  if (!decision || !decisionBy) return null;
  return (
    <>
      <Badge variant={decision === "approved" ? "success" : "danger"}>
        {decision === "approved" ? "Đã duyệt" : "Đã từ chối"}
      </Badge>
      <p className="text-xs font-medium text-slate-700">{decisionBy.full_name}</p>
      {decisionAt && <p className="text-[11px] text-slate-400">{formatDateTime(decisionAt)}</p>}
      {decisionNote && <p className="mt-1 text-xs text-slate-500 italic">&ldquo;{decisionNote}&rdquo;</p>}
    </>
  );
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): xem lại 1 đơn xin nghỉ phép
 * theo ĐÚNG khung "tờ đơn" (dữ liệu tĩnh thay vì ô nhập), kèm nút Duyệt/Từ
 * chối đặt NGAY tại đúng ô "Xác nhận của Leader"/"Xác nhận của Quản lý" khi
 * người xem có quyền duyệt ở đúng bước hiện tại của đơn — "sau khi leader
 * duyệt xong sẽ hiện đã duyệt trong xác nhận của leader và chuyển cho admin
 * duyệt tiếp" (nguyên văn yêu cầu).
 */
export function LeaveRequestDetailModal({
  request,
  currentUser,
  onClose,
  onDecided,
  onError,
}: {
  request: LeaveRequest;
  currentUser: Account;
  onClose: () => void;
  onDecided: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canLeaderDecide = currentUser.role === "leader" && request.status === "pending_leader";
  const canAdminDecide = currentUser.role === "admin" && request.status === "pending_admin";

  async function handleDecision(stage: "leader" | "admin", decision: "approved" | "rejected") {
    setIsSubmitting(true);
    try {
      await clientApi(`/leave-request/${request.id}/${stage}-decision`, {
        method: "POST",
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      await onDecided(
        decision === "approved"
          ? `Đã duyệt đơn của ${request.account.full_name}`
          : `Đã từ chối đơn của ${request.account.full_name}`,
      );
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  let leaderBlock;
  if (request.leader_decision) {
    leaderBlock = (
      <DecisionResult
        decision={request.leader_decision}
        decisionBy={request.leader_decision_by}
        decisionAt={request.leader_decision_at}
        decisionNote={request.leader_note}
      />
    );
  } else if (request.status === "pending_leader") {
    leaderBlock = canLeaderDecide ? (
      <DecisionActions note={note} onNoteChange={setNote} isSubmitting={isSubmitting} onDecide={(d) => void handleDecision("leader", d)} />
    ) : (
      <p className="text-xs text-slate-400 italic">Đang chờ Leader duyệt</p>
    );
  } else {
    leaderBlock = <p className="text-xs text-slate-400 italic">Không có Leader phụ trách</p>;
  }

  let adminBlock;
  if (request.admin_decision) {
    adminBlock = (
      <DecisionResult
        decision={request.admin_decision}
        decisionBy={request.admin_decision_by}
        decisionAt={request.admin_decision_at}
        decisionNote={request.admin_note}
      />
    );
  } else if (request.status === "pending_admin") {
    adminBlock = canAdminDecide ? (
      <DecisionActions note={note} onNoteChange={setNote} isSubmitting={isSubmitting} onDecide={(d) => void handleDecision("admin", d)} />
    ) : (
      <p className="text-xs text-slate-400 italic">Đang chờ Admin duyệt</p>
    );
  } else {
    adminBlock = <p className="text-xs text-slate-400 italic">Chưa tới lượt</p>;
  }

  return (
    <Modal
      title="Chi tiết đơn xin nghỉ phép"
      description={`${request.account.full_name} — gửi lúc ${formatDateTime(request.created_at)}`}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Badge variant={STATUS_BADGE[request.status].variant}>{STATUS_BADGE[request.status].label}</Badge>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      }
    >
      <LeaveRequestPaper
        fullName={request.account.full_name}
        position={request.employee_position ?? "—"}
        department={request.employee_department ?? "—"}
        daysCount={request.days_count}
        signatureDate={request.created_at.slice(0, 10)}
        recipientSlot={<span className="font-medium text-slate-900">{request.recipient_text ?? "—"}</span>}
        dateRangeSlot={
          <span className="font-medium text-slate-900">
            {formatDateOnly(request.start_date)} đến ngày {formatDateOnly(request.end_date)}
          </span>
        }
        reasonSlot={<p className="whitespace-pre-wrap text-slate-900">{request.reason}</p>}
        handoverSlot={<span className="font-medium text-slate-900">{request.handover_to || "—"}</span>}
        leaderBlock={leaderBlock}
        adminBlock={adminBlock}
      />
    </Modal>
  );
}

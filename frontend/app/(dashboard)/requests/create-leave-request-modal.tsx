"use client";

import { useState } from "react";
import { clientApi } from "@/lib/api-client";
import { ACCOUNT_ROLE_LABEL, type Account, type LeaveRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiErrorMessage } from "./leave-request-client";
import { LeaveRequestPaper } from "./leave-request-paper";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeDaysCount(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

const inlineInputClass =
  "min-w-0 flex-1 border-b border-dotted border-slate-400 bg-transparent px-1 py-0.5 text-[13px] text-slate-900 outline-none focus:border-brand-500 sm:text-sm";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): "mẫu đơn sẽ trình bày y hệt
 * như thế" — dùng chung khung "tờ đơn" (LeaveRequestPaper). Họ tên/Chức
 * vụ/Bộ phận tự điền từ tài khoản đang đăng nhập (đúng "thiết kế logic",
 * khỏi gõ lại), các ô còn lại (Kính gửi/Thời gian nghỉ/Lý do/Bàn giao) mở
 * cho nhân viên tự gõ ngay trên "tờ đơn" (input viền chấm mờ, giống gạch
 * chấm trên giấy thật). Số ngày nghỉ TỰ TÍNH từ khoảng ngày, không cho gõ
 * tay — khớp cách server tính lại (không tin client) để 2 bên không lệch.
 */
export function CreateLeaveRequestModal({
  currentUser,
  onClose,
  onCreated,
}: {
  currentUser: Account;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [recipientText, setRecipientText] = useState("Ban Giám đốc / Quản lý");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [handoverTo, setHandoverTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const daysCount = computeDaysCount(startDate, endDate);

  async function handleSubmit() {
    setError(null);
    if (!startDate || !endDate) {
      setError("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc");
      return;
    }
    if (daysCount === null) {
      setError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
      return;
    }
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do nghỉ");
      return;
    }
    if (!handoverTo.trim()) {
      setError("Vui lòng nhập người đã bàn giao công việc");
      return;
    }

    setIsSubmitting(true);
    try {
      await clientApi<LeaveRequest>("/leave-request", {
        method: "POST",
        body: JSON.stringify({
          recipient_text: recipientText.trim() || undefined,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          handover_to: handoverTo.trim(),
        }),
      });
      await onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const employeePosition = currentUser.position ?? ACCOUNT_ROLE_LABEL[currentUser.role];

  return (
    <Modal
      title="Tạo đơn xin nghỉ phép"
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang gửi..." : "Gửi đơn"}
          </Button>
        </>
      }
    >
      <LeaveRequestPaper
        fullName={currentUser.full_name}
        position={employeePosition}
        department={currentUser.team_name ?? "—"}
        daysCount={daysCount}
        signatureDate={new Date().toISOString().slice(0, 10)}
        recipientSlot={
          <input
            value={recipientText}
            onChange={(event) => setRecipientText(event.target.value)}
            className={inlineInputClass}
            placeholder="Ban Giám đốc / Quản lý ..."
          />
        }
        dateRangeSlot={
          <span className="flex flex-wrap items-center gap-1.5">
            Từ ngày
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-900 outline-none focus:border-brand-500"
            />
            đến ngày
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-900 outline-none focus:border-brand-500"
            />
          </span>
        }
        reasonSlot={
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Trình bày lý do xin nghỉ..."
            className="w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-[13px] text-slate-900 outline-none focus:border-brand-500 sm:text-sm"
          />
        }
        handoverSlot={
          <input
            value={handoverTo}
            onChange={(event) => setHandoverTo(event.target.value)}
            placeholder="Tên đồng nghiệp"
            required
            className={inlineInputClass}
          />
        }
        leaderBlock={<p className="text-xs text-slate-400 italic">Chờ gửi đơn</p>}
        adminBlock={<p className="text-xs text-slate-400 italic">Chờ gửi đơn</p>}
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </Modal>
  );
}

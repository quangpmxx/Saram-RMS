"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiErrorMessage } from "./leave-request-client";
import { AnonymousFeedbackPaper, vnDateOnly } from "./anonymous-feedback-paper";

const lineInputClass =
  "w-full border-b border-dotted border-slate-400 bg-transparent px-1 py-0.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand-500 sm:text-sm";

/**
 * Đơn phản ánh ẩn danh (2026-10-28) — soạn trên "tờ A4" (AnonymousFeedbackPaper).
 * Mọi nội dung nhập tay; không điền sẵn tên/chức vụ/bộ phận (khác đơn nghỉ
 * phép) để không lộ người gửi.
 */
export function CreateAnonymousFeedbackModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [recipient, setRecipient] = useState("Ban Giám đốc / Quản lý");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!recipient.trim() || !subject.trim() || !content.trim()) {
      setError('Vui lòng nhập đủ "Kính gửi", "Về việc" và nội dung phản ánh');
      return;
    }
    setIsSubmitting(true);
    try {
      await clientApi("/anonymous-feedback", {
        method: "POST",
        body: JSON.stringify({ recipient: recipient.trim(), subject: subject.trim(), content: content.trim() }),
      });
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title="Gửi đơn phản ánh ẩn danh"
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang gửi..." : "Gửi đơn ẩn danh"}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex gap-2 rounded-lg bg-brand-50 p-3 text-xs text-brand-900">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
        <p>
          Quản lý và Admin <b>không thấy tên bạn</b> trên đơn và trong thông báo. Sau khi gửi, bạn sẽ{" "}
          <b>không xem lại được</b> đơn này — hãy kiểm tra kỹ nội dung trước khi gửi.
        </p>
      </div>

      <AnonymousFeedbackPaper
        date={vnDateOnly()}
        recipientSlot={
          <input
            value={recipient}
            maxLength={200}
            onChange={(e) => setRecipient(e.target.value)}
            className={lineInputClass}
            placeholder="Ban Giám đốc / Quản lý ..."
          />
        }
        subjectSlot={
          <input
            value={subject}
            maxLength={300}
            onChange={(e) => setSubject(e.target.value)}
            className={lineInputClass}
            placeholder="Tóm tắt vấn đề cần phản ánh"
          />
        }
        contentSlot={
          <textarea
            value={content}
            maxLength={10000}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            placeholder="Trình bày chi tiết nội dung phản ánh..."
            className="w-full resize-y rounded border border-slate-200 bg-[repeating-linear-gradient(transparent,transparent_27px,#e2e8f0_28px)] px-2 py-1 text-[13px] leading-7 text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand-500 sm:text-sm"
          />
        }
      />
      <p className="mt-1 text-right text-[11px] text-slate-400">{content.length.toLocaleString("vi-VN")} / 10.000 ký tự</p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </Modal>
  );
}

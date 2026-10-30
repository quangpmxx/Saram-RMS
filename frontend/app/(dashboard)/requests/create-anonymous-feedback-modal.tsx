"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, ShieldCheck } from "lucide-react";
import { clientApi, clientApiUpload } from "@/lib/api-client";
import {
  ACCOUNT_ROLE_LABEL,
  type AnonymousFeedbackRecipient,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { apiErrorMessage } from "./leave-request-client";
import { AnonymousFeedbackPaper, vnDateOnly } from "./anonymous-feedback-paper";
import {
  FEEDBACK_MAX_IMAGES,
  FeedbackImageGrid,
  sanitizeImage,
} from "./feedback-images";

const lineInputClass =
  "w-full border-b border-dotted border-slate-400 bg-transparent px-1 py-0.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand-500 sm:text-sm";

interface PickedImage {
  blob: Blob;
  url: string;
}

/**
 * Đơn phản ánh ẩn danh (2026-10-28) — soạn trên "tờ A4" (AnonymousFeedbackPaper).
 * Mọi nội dung nhập tay; không điền sẵn tên/chức vụ/bộ phận (khác đơn nghỉ
 * phép) để không lộ người gửi.
 * 2026-10-30: chọn người nhận (tất cả Admin + Quản lý, hoặc từng người) và
 * đính kèm tối đa 5 ảnh — ảnh được vẽ lại để xoá thông tin máy/GPS, xem
 * trước ngay trên lá đơn.
 */
export function CreateAnonymousFeedbackModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [recipients, setRecipients] = useState<AnonymousFeedbackRecipient[]>(
    [],
  );
  const [sendToAll, setSendToAll] = useState(true);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<PickedImage[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    clientApi<AnonymousFeedbackRecipient[]>("/anonymous-feedback/recipients")
      .then(setRecipients)
      .catch((err: unknown) => setError(apiErrorMessage(err)));
  }, []);

  // Đóng form → giải phóng ảnh xem trước.
  useEffect(
    () => () =>
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.url)),
    [],
  );

  function togglePicked(id: string) {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePickImages(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = FEEDBACK_MAX_IMAGES - images.length;
    const selected = Array.from(files).slice(0, room);
    if (files.length > room)
      setError(`Chỉ đính kèm tối đa ${FEEDBACK_MAX_IMAGES} ảnh`);
    setIsProcessingImages(true);
    try {
      const added: PickedImage[] = [];
      for (const file of selected) {
        const blob = await sanitizeImage(file);
        added.push({ blob, url: URL.createObjectURL(blob) });
      }
      setImages((prev) => [...prev, ...added]);
    } catch {
      setError("Có ảnh không đọc được — vui lòng chọn ảnh JPEG, PNG hoặc WebP");
    } finally {
      setIsProcessingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit() {
    setError(null);
    if (!subject.trim() || !content.trim()) {
      setError("Vui lòng nhập đủ tiêu đề và nội dung phản ánh");
      return;
    }
    if (!sendToAll && pickedIds.size === 0) {
      setError("Vui lòng chọn ít nhất 1 người nhận");
      return;
    }
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append("subject", subject.trim());
      form.append("content", content.trim());
      form.append(
        "recipient_ids",
        JSON.stringify(sendToAll ? [] : [...pickedIds]),
      );
      images.forEach((img, index) =>
        form.append(
          "images",
          new File([img.blob], `anh-${index + 1}.jpg`, { type: "image/jpeg" }),
        ),
      );
      await clientApiUpload("/anonymous-feedback", form);
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
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || isProcessingImages}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? "Đang gửi..." : "Gửi đơn ẩn danh"}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex gap-2 rounded-lg bg-brand-50 p-3 text-xs text-brand-900">
        <ShieldCheck
          className="h-4 w-4 shrink-0 text-brand-600"
          strokeWidth={2}
        />
        <p>
          Người nhận <b>không thấy tên bạn</b> trên đơn và trong thông báo. Sau
          khi gửi, bạn sẽ <b>không xem lại được</b> đơn này — hãy kiểm tra kỹ
          nội dung trước khi gửi.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 p-3 text-sm">
        <p className="mb-2 font-medium text-slate-800">Gửi tới</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              checked={sendToAll}
              onChange={() => setSendToAll(true)}
            />
            Tất cả Admin và Quản lý
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              checked={!sendToAll}
              onChange={() => setSendToAll(false)}
            />
            Chọn người nhận
          </label>
        </div>
        {!sendToAll && (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-100 pt-2">
            {recipients.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-1.5"
              >
                <Checkbox
                  checked={pickedIds.has(r.id)}
                  onChange={() => togglePicked(r.id)}
                />
                {r.full_name}
                <span className="text-xs text-slate-400">
                  ({ACCOUNT_ROLE_LABEL[r.role]})
                </span>
              </label>
            ))}
            {recipients.length === 0 && (
              <p className="text-xs text-slate-400">Đang tải danh sách…</p>
            )}
          </div>
        )}
      </div>

      <AnonymousFeedbackPaper
        date={vnDateOnly()}
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
        attachmentsSlot={
          <FeedbackImageGrid
            urls={images.map((img) => img.url)}
            onRemove={removeImage}
          />
        }
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => void handlePickImages(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              images.length >= FEEDBACK_MAX_IMAGES || isProcessingImages
            }
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" strokeWidth={2} />
            {isProcessingImages
              ? "Đang xử lý ảnh..."
              : `Đính kèm ảnh (${images.length}/${FEEDBACK_MAX_IMAGES})`}
          </Button>
        </div>
        <p className="text-[11px] text-slate-400">
          {content.length.toLocaleString("vi-VN")} / 10.000 ký tự
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </Modal>
  );
}

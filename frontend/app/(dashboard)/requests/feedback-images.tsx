"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { clientApiBlob } from "@/lib/api-client";

/** Khớp backend (anonymous-feedback.service.ts): tối đa 5 ảnh, mỗi ảnh ≤ 5MB. */
export const FEEDBACK_MAX_IMAGES = 5;
const MAX_EDGE = 1600;

/**
 * Vẽ lại ảnh lên canvas rồi xuất JPEG mới (2026-10-30): xoá sạch thông tin
 * ẩn trong file gốc (hãng/đời máy, vị trí GPS, thời gian chụp...) có thể làm
 * lộ người gửi đơn ẩn danh; đồng thời thu nhỏ ảnh lớn (cạnh dài ≤ 1600px)
 * cho nhẹ. Hướng xoay của ảnh điện thoại được áp trước khi vẽ.
 */
export async function sanitizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không xử lý được ảnh");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Không đọc được ảnh")),
      "image/jpeg",
      0.85,
    ),
  );
}

/** Lưới ảnh đính kèm trên lá đơn — bấm ảnh để xem cỡ lớn; `onRemove` khi đang soạn. */
export function FeedbackImageGrid({
  urls,
  onRemove,
}: {
  urls: string[];
  onRemove?: (index: number) => void;
}) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-[13px] font-semibold text-slate-800 sm:text-sm">
        Ảnh đính kèm:
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {urls.map((url, index) => (
          <div
            key={url}
            className="relative overflow-hidden rounded border border-slate-200 bg-slate-50"
          >
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title="Xem ảnh cỡ lớn"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh blob cục bộ, không qua next/image */}
              <img
                src={url}
                alt={`Ảnh đính kèm ${index + 1}`}
                className="aspect-[4/3] w-full object-cover"
              />
            </a>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                title="Bỏ ảnh này"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tải ảnh của 1 đơn (cần đăng nhập + là người nhận) rồi hiện lên lá đơn. */
export function FeedbackStoredImages({
  feedbackId,
  count,
}: {
  feedbackId: string;
  count: number;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    let cancelled = false;
    const created: string[] = [];
    Promise.all(
      Array.from({ length: count }, (_, index) =>
        clientApiBlob(`/anonymous-feedback/${feedbackId}/images/${index}`),
      ),
    )
      .then((blobs) => {
        for (const blob of blobs) created.push(URL.createObjectURL(blob));
        if (!cancelled) setUrls(created);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [feedbackId, count]);

  if (count === 0) return null;
  if (error)
    return (
      <p className="mt-4 text-xs text-red-600">Không tải được ảnh đính kèm.</p>
    );
  if (urls.length === 0)
    return (
      <p className="mt-4 text-xs text-slate-400">
        Đang tải {count} ảnh đính kèm…
      </p>
    );
  return <FeedbackImageGrid urls={urls} />;
}

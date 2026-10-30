import type { ReactNode } from "react";

/**
 * Font "giấy tờ" có đủ dấu tiếng Việt. KHÔNG dùng class `font-serif` của
 * Tailwind — stack đó ưu tiên Georgia, thiếu glyph cho chữ 2 dấu chồng
 * (ế, ề, ố...) nên hiện vỡ thành "ê´", "ô`".
 */
export const PAPER_FONT = '"Times New Roman", Times, "Noto Serif", serif';

/**
 * Đơn phản ánh ẩn danh (2026-10-28, yêu cầu trực tiếp người dùng): "mẫu đơn
 * cho nhập tay hoàn toàn giống như tờ A4". Khung giấy dùng CHUNG cho lúc soạn
 * (ô nhập) lẫn lúc Quản lý/Admin xem lại (chữ tĩnh) — cùng cách
 * LeaveRequestPaper đã làm. Tỉ lệ khổ A4 (210×297) — nội dung dài thì tờ giấy
 * dài ra theo, không cắt chữ. Phần ký luôn là "(Ẩn danh)", không có tên.
 * Chỉ gồm Tiêu đề + Nội dung — bỏ tên công ty và "Kính gửi" (yêu cầu người
 * dùng, 2026-10-28).
 */
export function AnonymousFeedbackPaper({
  subjectSlot,
  contentSlot,
  attachmentsSlot,
  date,
}: {
  subjectSlot: ReactNode;
  contentSlot: ReactNode;
  /** Ảnh đính kèm hiện ngay trên lá đơn, dưới phần nội dung (2026-10-30). */
  attachmentsSlot?: ReactNode;
  /** "YYYY-MM-DD" theo giờ Việt Nam — ngày gửi đơn. */
  date: string;
}) {
  const [y, m, d] = date.split("-");

  return (
    <div
      className="mx-auto aspect-[210/297] h-auto w-full max-w-[680px] rounded-sm border border-slate-200 bg-white px-6 py-8 shadow-[0_2px_12px_rgba(15,23,42,0.08)] sm:px-12 sm:py-12"
      style={{ fontFamily: PAPER_FONT }}
    >
      <div className="flex h-full flex-col">
        <p className="text-center text-lg font-bold tracking-wide text-slate-900 uppercase sm:text-xl">
          Đơn phản ánh
        </p>

        <div className="mt-8 flex flex-col gap-3 text-[13px] leading-relaxed text-slate-800 sm:text-sm">
          <div className="flex items-baseline gap-2">
            <span className="w-20 shrink-0 font-semibold">Tiêu đề:</span>
            <div className="min-w-0 flex-1">{subjectSlot}</div>
          </div>
          <div className="mt-3">
            <p className="font-semibold">Nội dung phản ánh:</p>
            <div className="mt-2">{contentSlot}</div>
          </div>
          {attachmentsSlot}
        </div>

        <div className="mt-auto pt-10 text-right text-[13px] text-slate-700 sm:text-sm">
          <p className="italic">
            Ngày {Number(d) || "…"} tháng {Number(m) || "…"} năm {y || "…"}
          </p>
          <p className="mt-3 font-semibold">Người phản ánh</p>
          <p className="mt-6 text-slate-500 italic">(Ẩn danh)</p>
        </div>
      </div>
    </div>
  );
}

/** "YYYY-MM-DD" theo giờ Việt Nam — tránh lệch ngày khi dùng toISOString() (giờ UTC). */
export function vnDateOnly(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

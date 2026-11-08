import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export function Modal({
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  /** Bỏ trống = không có phần tiêu đề. */
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  // Dự án phụ — nâng cấp toàn diện: render qua Portal thẳng vào document.body
  // — bắt buộc phải làm vậy vì nút mở popup có thể nằm trong 1 khối cha có
  // "backdrop-blur" (vd thanh header) — CSS backdrop-filter tạo ra 1
  // "containing block" mới cho mọi phần tử con position:fixed bên trong nó,
  // khiến popup "cố định toàn màn hình" bị nhốt gọn trong đúng khung của
  // khối cha đó thay vì phủ hết trang (bug: popup chỉ hiện 1 mẩu nhỏ, không
  // có nền mờ, không thấy tiêu đề). Portal thoát hẳn khỏi cây DOM của nút
  // mở popup nên không còn bị ảnh hưởng bởi containing block của tổ tiên.
  return createPortal(
    // z-[60] — CAO HƠN header dùng chung (z-50, xem layout.tsx) — yêu cầu
    // trực tiếp người dùng: header là lớp cao nhất, NGOẠI TRỪ khi có popup
    // đang mở thì popup phải nổi trên cả header (đúng UX popup thông
    // thường: nền mờ che hết trang, kể cả header).
    // Điện thoại (<sm): popup nằm GIỮA màn hình (user 2026-11-04, bỏ kiểu dính đáy),
    // lề 12px, nút bấm ở chân tự xuống dòng. Từ sm trở lên giữ nguyên như cũ.
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex min-h-full items-center justify-center">
        {/* max-h-[85vh] + overflow-y-auto: modal có nội dung dài hơn màn hình
            (vd Cài đặt tài khoản: ảnh đại diện + họ tên + đổi mật khẩu) vẫn
            cuộn được bên trong thay vì bị đẩy tràn lên trên, mất cả tiêu đề
            lẫn phần đầu nội dung. Modal ngắn (đa số hiện có) không bị ảnh
            hưởng vì chưa bao giờ chạm ngưỡng 85vh. */}
        <div
          className={cn(
            "flex max-h-[90dvh] w-full flex-col rounded-2xl bg-white shadow-2xl shadow-slate-900/20 sm:my-8 sm:max-h-[85vh]",
            maxWidth,
          )}
        >
          {(title || description) && (
            <div className="shrink-0 p-4 pb-0 sm:p-6 sm:pb-0">
              {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
          )}
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 p-4 pt-3 sm:p-6 sm:pt-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

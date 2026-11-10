"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Khung popup lớn cho Chi tiết lao động (2026-11-10). z-[55]: trên header
 * chung (z-50), dưới các Modal con (z-[60]) mở từ bên trong (đặt lịch gọi
 * lại...). Đóng bằng nút X, phím Esc hoặc bấm ra vùng tối bên ngoài.
 *
 * `onClose` mặc định = router.back() (quay về trang đang xem phía sau);
 * trang chi tiết truyền hàm riêng để LƯU thay đổi trước khi đóng.
 */
export function CandidateDetailModalFrame({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const router = useRouter();
  const close = onClose ?? (() => router.back());

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Esc trong 1 Modal con (z-[60]) để Modal đó tự xử lý.
      if (event.key !== "Escape" || document.querySelector(".z-\\[60\\]")) return;
      close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="fixed inset-0 z-[55] bg-slate-900/50 backdrop-blur-[2px] sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="relative mx-auto flex h-full max-w-[1500px] flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-xl">
        <button
          type="button"
          onClick={close}
          title="Đóng (Esc)"
          aria-label="Đóng"
          className="absolute top-2 right-2 z-10 rounded-full bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-white hover:text-slate-800"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

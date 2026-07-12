"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastType = "error" | "success" | "warning";
interface ToastValue {
  id: number;
  type: ToastType;
  text: string;
}

const TOAST_DURATION_MS = 3000;

const CLASSES: Record<ToastType, string> = {
  error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/15",
};

const ICONS: Record<ToastType, typeof AlertTriangle> = {
  error: AlertTriangle,
  success: CheckCircle2,
  warning: TriangleAlert,
};

// Tách riêng 2 context (setter ổn định / value đổi liên tục) — cùng lý do
// đã áp dụng ở page-title-context.tsx: gộp chung 1 object sẽ khiến object
// đó bị tạo mới mỗi lần render, kéo theo re-render thừa ở mọi nơi gọi
// useToast() dù chỉ cần hàm hiển thị, không cần đọc giá trị đang hiện.
const ShowToastContext = createContext<((type: ToastType, text: string) => void) | null>(null);
const ToastValueContext = createContext<ToastValue | null>(null);

/**
 * Dự án phụ — nâng cấp toàn diện: thay toàn bộ Banner "nằm im trong trang"
 * (Đã lưu/Đã xóa/lỗi...) bằng 1 thông báo nổi DUY NHẤT ở giữa thanh header,
 * tự biến mất sau 3 giây — theo đúng yêu cầu trực tiếp người dùng ("thông
 * báo không tự động biến mất" là vấn đề cần sửa ở TẤT CẢ các trang, không
 * riêng 1 chỗ). ToastProvider bọc quanh toàn bộ layout Dashboard;
 * useToast() gọi được từ bất kỳ trang con nào.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastValue | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((type: ToastType, text: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const id = ++idRef.current;
    setToast({ id, type, text });
    timeoutRef.current = setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <ShowToastContext.Provider value={showToast}>
      <ToastValueContext.Provider value={toast}>{children}</ToastValueContext.Provider>
    </ShowToastContext.Provider>
  );
}

/** Dùng: const toast = useToast(); toast.success("Đã lưu"); toast.error("..."); toast.warning("..."). */
export function useToast(): { success: (text: string) => void; error: (text: string) => void; warning: (text: string) => void } {
  const showToast = useContext(ShowToastContext);
  if (!showToast) throw new Error("useToast phải được gọi bên trong ToastProvider");
  return {
    success: (text: string) => showToast("success", text),
    error: (text: string) => showToast("error", text),
    warning: (text: string) => showToast("warning", text),
  };
}

/**
 * Render qua Portal thẳng vào document.body (giống Modal/NotificationBell,
 * xem ghi chú ở components/ui/modal.tsx) — đặt trong header có "backdrop-blur"
 * nên bắt buộc phải portal, nếu không position:fixed sẽ bị nhốt trong khung
 * header thay vì nổi giữa trang.
 */
export function ToastSlot() {
  const toast = useContext(ToastValueContext);
  if (!toast || typeof document === "undefined") return null;

  const Icon = ICONS[toast.type];
  return createPortal(
    <div className="pointer-events-none fixed top-2.5 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 px-4">
      <div
        role="status"
        className={cn(
          "mx-auto flex w-fit max-w-full items-start gap-2 rounded-2xl px-4 py-2 text-sm shadow-lg shadow-slate-900/10",
          CLASSES[toast.type],
        )}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
        <p className="whitespace-pre-line">{toast.text}</p>
      </div>
    </div>,
    document.body,
  );
}

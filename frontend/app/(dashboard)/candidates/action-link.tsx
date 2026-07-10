import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  default: "text-slate-500 hover:bg-brand-50 hover:text-brand-700",
  danger: "text-slate-500 hover:bg-red-50 hover:text-red-600",
};

/**
 * UI Polish — cột "Hành động" dùng icon + chữ nhỏ thay vì Button lớn, để
 * bảng gọn và hiện đại hơn (không đổi hành vi/quyền, chỉ đổi cách hiển thị).
 */
export function ActionLink({
  icon,
  tone = "default",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; tone?: Tone }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

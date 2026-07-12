import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
/**
 * `xs`: UI Polish — tinh chỉnh mật độ hiển thị riêng cho bộ lọc trang Ứng
 * viên — KHÔNG đổi `sm`/`md` để không ảnh hưởng các nút khác đang dùng
 * chung 2 size đó ở khắp nơi trong app.
 */
type Size = "xs" | "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent-500 text-white shadow-sm shadow-accent-500/25 hover:bg-accent-600 focus-visible:outline-accent-500",
  secondary:
    "bg-brand-700 text-white shadow-sm shadow-brand-700/20 hover:bg-brand-800 focus-visible:outline-brand-700",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-brand-500",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:outline-brand-500",
  danger: "text-red-600 hover:bg-red-50 focus-visible:outline-red-500",
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}

import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * `sm`: dùng cho khu vực cần tối ưu chiều cao (vd. thanh bộ lọc) — mặc định
 * `md` giữ nguyên hành vi cũ ở mọi nơi khác.
 * `xs`: UI Polish — tinh chỉnh mật độ hiển thị riêng cho bộ lọc trang Ứng
 * viên (giảm thêm ~20% so với `sm`) — KHÔNG đổi `sm`/`md` để không ảnh
 * hưởng các trang khác đang dùng chung 2 size đó (Dashboard, Nhật ký,
 * Trùng lặp, Báo cáo...).
 */
type FieldSize = "xs" | "sm" | "md";

const fieldBaseClass =
  "w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-400";

const FIELD_SIZE_CLASSES: Record<FieldSize, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
};

export function Field({
  label,
  hint,
  children,
  uiSize = "md",
  className,
  ...props
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  uiSize?: FieldSize;
} & LabelHTMLAttributes<HTMLLabelElement>) {
  const isCompact = uiSize === "sm" || uiSize === "xs";
  return (
    <label
      className={cn(
        "flex flex-col",
        uiSize === "xs" ? "gap-0.5 text-xs" : uiSize === "sm" ? "gap-1 text-xs" : "gap-1.5 text-sm",
        className,
      )}
      {...props}
    >
      <span className={cn("font-medium text-slate-700", isCompact && "text-xs")}>{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Input({
  className,
  uiSize = "md",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { uiSize?: FieldSize }) {
  return <input className={cn(fieldBaseClass, FIELD_SIZE_CLASSES[uiSize], className)} {...props} />;
}

export function Select({
  className,
  uiSize = "md",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { uiSize?: FieldSize }) {
  return <select className={cn(fieldBaseClass, FIELD_SIZE_CLASSES[uiSize], className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBaseClass, FIELD_SIZE_CLASSES.md, className)} {...props} />;
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-slate-300 text-accent-500 focus:ring-2 focus:ring-accent-500/30",
        className,
      )}
      {...props}
    />
  );
}

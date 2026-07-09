import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Modal({
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className={cn("w-full rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/20", maxWidth)}>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

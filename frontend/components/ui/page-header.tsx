import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** `compact`: dùng cho màn cần tối ưu chiều dọc (vd. bảng dữ liệu dài) — không đổi mặc định của các trang khác. */
export function PageHeader({
  title,
  description,
  actions,
  compact = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", compact ? "mb-3" : "mb-6")}>
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

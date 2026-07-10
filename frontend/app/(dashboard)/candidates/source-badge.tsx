import { cn } from "@/lib/cn";

/**
 * UI Polish — mỗi nguồn kênh 1 màu riêng để dễ quét mắt trên bảng, tách
 * riêng khỏi <Badge> dùng chung (vốn chỉ có 6 màu ngữ nghĩa cố định) vì
 * nguồn kênh là danh mục mở (LeadSource), cần nhiều màu hơn.
 */
const KNOWN_SOURCE_CLASSES: Record<string, string> = {
  Facebook: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  TikTok: "bg-slate-900 text-white ring-1 ring-inset ring-slate-900/10",
  Zalo: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20",
  "Website": "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  "Giới thiệu": "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  Khác: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10",
};

/** Bảng màu dự phòng, xoay vòng theo hash tên — ổn định qua mỗi lần render. */
const FALLBACK_CLASSES = [
  "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20",
  "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
  "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20",
  "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function SourceBadge({ name, className }: { name: string; className?: string }) {
  const classes = KNOWN_SOURCE_CLASSES[name] ?? FALLBACK_CLASSES[hashName(name) % FALLBACK_CLASSES.length];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        classes,
        className,
      )}
    >
      {name}
    </span>
  );
}

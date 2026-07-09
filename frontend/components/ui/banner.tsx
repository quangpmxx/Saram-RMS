import { AlertTriangle, CheckCircle2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type BannerType = "error" | "success" | "warning";

const CLASSES: Record<BannerType, string> = {
  error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/15",
};

const ICONS: Record<BannerType, typeof AlertTriangle> = {
  error: AlertTriangle,
  success: CheckCircle2,
  warning: TriangleAlert,
};

export function Banner({ type, text }: { type: BannerType; text: string }) {
  const Icon = ICONS[type];
  return (
    <div role="status" className={cn("mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm", CLASSES[type])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
      <p className="whitespace-pre-line">{text}</p>
    </div>
  );
}

import { cn } from "@/lib/cn";

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return last.slice(0, 1).toUpperCase() || "?";
}

export function Avatar({ fullName, className }: { fullName: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-semibold text-white",
        className,
      )}
    >
      {getInitials(fullName)}
    </span>
  );
}

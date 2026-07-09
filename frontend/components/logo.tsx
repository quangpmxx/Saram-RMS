import Image from "next/image";
import { cn } from "@/lib/cn";

const MARK_PX = {
  sm: 34,
  md: 40,
} as const;

export function Logo({
  size = "md",
  variant = "dark",
  showWordmark = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
  showWordmark?: boolean;
  className?: string;
}) {
  if (size === "lg") {
    return (
      <div className={cn("relative h-28 w-28 sm:h-32 sm:w-32", className)}>
        <Image src="/saram-logo.jpg" alt="Saram Group" fill sizes="128px" className="object-contain" priority />
      </div>
    );
  }

  const px = MARK_PX[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5"
        style={{ width: px, height: px }}
      >
        <Image src="/saram-logo.jpg" alt="Saram Group" fill sizes={`${px}px`} className="object-contain p-0.5" />
      </div>
      {showWordmark && (
        <span
          className={cn(
            "font-bold tracking-tight",
            size === "md" ? "text-base" : "text-sm",
            variant === "light" ? "text-white" : "text-brand-900",
          )}
        >
          Saram Vina
        </span>
      )}
    </div>
  );
}

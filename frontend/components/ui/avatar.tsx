import { cn } from "@/lib/cn";

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return last.slice(0, 1).toUpperCase() || "?";
}

/**
 * Dự án phụ — nâng cấp toàn diện: ảnh đại diện tự upload. `avatarUrl` là
 * đường dẫn tương đối từ backend (vd "/uploads/avatars/xxx.jpg", xem
 * POST /me/avatar) — ghép với NEXT_PUBLIC_API_URL ("/api", tự proxy sang
 * backend qua next.config.ts) để trình duyệt tải đúng ảnh dù chạy qua
 * tunnel. Không dùng next/image vì đây là ảnh phục vụ qua proxy nội bộ,
 * không phải asset tĩnh trong /public. Chưa có ảnh → dùng chữ cái như cũ.
 */
export function Avatar({
  fullName,
  avatarUrl,
  className,
}: {
  fullName: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh qua proxy nội bộ, không phải asset tĩnh trong /public
      <img
        src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${avatarUrl}`}
        alt={fullName}
        className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

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

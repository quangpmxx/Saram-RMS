import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): "Phân quyền" phiên bản đơn giản, Mục 2 — "Không có quyền: Không
 * truy cập được URL". Đích chuyển hướng dùng chung cho MỌI trang bị
 * requirePageAccess() chặn (xem lib/module-permission.ts).
 */
export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
        <ShieldX className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-800">Bạn không có quyền thao tác với trang này</p>
        <p className="mt-1 text-sm text-slate-500">Liên hệ Admin nếu bạn cho rằng đây là nhầm lẫn.</p>
      </div>
      <Link href="/">
        <Button type="button" variant="outline" size="sm">
          Về trang chủ
        </Button>
      </Link>
    </div>
  );
}

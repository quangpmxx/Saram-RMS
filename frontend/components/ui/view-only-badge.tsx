import { Eye } from "lucide-react";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): "Phân quyền" phiên bản đơn giản, Mục 2 — "Chỉ xem: được mở trang
 * và xem dữ liệu... tất cả nút thao tác chuyển sang disabled hoặc ẩn."
 * Badge nhỏ hiện ở đầu mỗi trang bị giới hạn "Chỉ xem" — dùng chung cho mọi
 * module thay vì viết lặp lại từng trang.
 */
export function ViewOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
      <Eye className="h-3.5 w-3.5" strokeWidth={2} />
      Chỉ xem — không thể chỉnh sửa
    </span>
  );
}

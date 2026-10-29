/**
 * Định dạng ngày hiển thị dd/mm/yy cho module Data lao động (yêu cầu người
 * dùng 2026-10-29: "tất cả dữ liệu chứa ngày tháng năm ở trang Data lao động
 * đều để dd/mm/yy").
 */
export function formatDMY(value: string | Date): string {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** "HH:mm" theo giờ máy người dùng. */
export function formatHM(value: string | Date): string {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/** "HH:mm dd/mm/yy" — thời điểm ghi chú/thao tác. */
export function formatHMDMY(value: string | Date): string {
  return `${formatHM(value)} ${formatDMY(value)}`;
}

/** "dd/mm/yy HH:mm" — mốc phân công trong Kho chăm sóc. */
export function formatDMYHM(value: string | Date | null): string {
  if (!value) return "—";
  return `${formatDMY(value)} ${formatHM(value)}`;
}

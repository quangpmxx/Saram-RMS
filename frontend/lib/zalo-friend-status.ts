/**
 * Dự án phụ — nâng cấp toàn diện: màu "tag" Tình trạng Zalo (dùng ở trang
 * Chi tiết ứng viên và danh sách Ứng viên) — style inline (không qua
 * className) vì cn() không dedup, ghi đè class nền qua className không đáng
 * tin cậy (đã gặp lỗi này trước đây).
 */
export function zaloFriendStatusStyle(name: string): { backgroundColor: string; color: string } {
  // Xanh dương (yêu cầu người dùng 2026-10-29), trước là xanh lá.
  if (name === "Đã kết bạn Zalo") return { backgroundColor: "#2563eb", color: "#ffffff" };
  if (name === "Không có Zalo") return { backgroundColor: "#000000", color: "#ffffff" };
  return { backgroundColor: "#ffffff", color: "#334155" };
}

/**
 * Màu ô "Kết quả" (category zalo_status): "Đã gửi CCCD" xanh lá, "Đã phỏng
 * vấn" tím (2026-11-06); lựa chọn khác/để trống = không màu.
 */
export function resultStatusStyle(name: string | undefined): { backgroundColor: string; color: string } | undefined {
  if (name === "Đã gửi CCCD") return { backgroundColor: "#15803d", color: "#ffffff" };
  if (name === "Đã phỏng vấn") return { backgroundColor: "#7e22ce", color: "#ffffff" };
  return undefined;
}

/**
 * Danh sách thả xuống có lựa chọn mang màu (2026-11-06): mỗi dòng tô sẵn đúng
 * màu của nó; dòng trống/không màu = nền trắng chữ tối (tránh chữ trắng kế
 * thừa từ ô màu hiện trên nền trắng của danh sách).
 */
export const EMPTY_OPTION_STYLE = { backgroundColor: "#ffffff", color: "#334155" };

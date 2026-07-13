/**
 * Dự án phụ — nâng cấp toàn diện: màu "tag" Tình trạng Zalo (dùng ở trang
 * Chi tiết ứng viên và danh sách Ứng viên) — style inline (không qua
 * className) vì cn() không dedup, ghi đè class nền qua className không đáng
 * tin cậy (đã gặp lỗi này trước đây).
 */
export function zaloFriendStatusStyle(name: string): { backgroundColor: string; color: string } {
  if (name === "Đã kết bạn Zalo") return { backgroundColor: "#15803d", color: "#ffffff" };
  if (name === "Không có Zalo") return { backgroundColor: "#000000", color: "#ffffff" };
  return { backgroundColor: "#ffffff", color: "#334155" };
}

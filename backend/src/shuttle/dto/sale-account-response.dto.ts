/**
 * Dự án phụ — nâng cấp toàn diện: GET /shuttle/sale-accounts (role='sale')
 * và GET /shuttle/driver-accounts (role='shuttle_staff', bổ sung 2026-07-28)
 * — danh sách tài khoản thật, đang active, dùng làm nguồn gợi ý cho cột
 * "Sale"/"Đưa đón" của Danh sách đưa đón (yêu cầu trực tiếp người dùng: "lấy
 * nguồn danh sách nhân viên sale từ danh sách tài khoản"; 2026-07-28: "chuyển
 * cả 2 cột sang liên kết tài khoản thật"). Endpoint riêng, KHÔNG dùng chung
 * /account (chỉ Admin gọi được theo docs/13) — mọi vai trò đã đăng nhập đều
 * gọi được, chỉ trả về id/họ tên/biệt danh, không lộ thông tin nhạy cảm khác.
 */
export interface AccountOptionItemDto {
  id: string;
  full_name: string;
  /** Bổ sung 2026-07-26 (yêu cầu trực tiếp người dùng): biệt danh — hiển thị thay họ tên đầy đủ, null = chưa đặt (frontend tự fallback về full_name). */
  nickname: string | null;
}

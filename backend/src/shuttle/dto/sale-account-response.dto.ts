/**
 * Dự án phụ — nâng cấp toàn diện: GET /shuttle/sale-accounts — danh sách tài
 * khoản role=sale, đang active, dùng làm nguồn gợi ý cho cột "Sale" của
 * Danh sách đưa đón (yêu cầu trực tiếp người dùng: "lấy nguồn danh sách nhân
 * viên sale từ danh sách tài khoản" — để sau này làm báo cáo khớp đúng tài
 * khoản thật, không còn text tự nhập tự do). Endpoint riêng, KHÔNG dùng
 * chung /account (chỉ Admin gọi được theo docs/13) — mọi vai trò đã đăng
 * nhập đều gọi được endpoint này, chỉ trả về id + họ tên, không lộ thông tin
 * nhạy cảm khác của tài khoản.
 */
export interface SaleAccountItemDto {
  id: string;
  full_name: string;
}

-- Đơn phản ánh ẩn danh: bỏ "Kính gửi" (yêu cầu người dùng 2026-10-28) — đơn chỉ còn
-- tiêu đề + nội dung. Bảng mới tạo cùng ngày, chưa có dữ liệu thật khi xóa cột.
-- AlterTable
ALTER TABLE "anonymous_feedbacks" DROP COLUMN "recipient";


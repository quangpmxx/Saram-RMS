-- Thông báo cho Sale khi được chia/chuyển data (thủ công, hàng loạt, tự động)
-- (yêu cầu người dùng 2026-11-01). CHỈ THÊM 1 giá trị notification_type.
-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'lead_assigned';

-- Kho chăm sóc: thông báo cho Sale khi được giao data chăm sóc (yêu cầu người
-- dùng 2026-10-28). CHỈ THÊM 1 giá trị notification_type.
-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'care_assigned';


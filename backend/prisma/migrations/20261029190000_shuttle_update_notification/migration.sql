-- Thông báo Đưa đón lưu vào chuông (yêu cầu người dùng 2026-10-29): thêm 1 loại
-- thông báo + cột meta (JSON) chứa dữ liệu dựng nhãn màu. Không đổi dữ liệu cũ.
-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'shuttle_update';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "meta" JSONB;

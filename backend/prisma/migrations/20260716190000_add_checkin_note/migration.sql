-- AlterTable checkin_records: thêm ghi chú tự do của Admin (yêu cầu trực
-- tiếp người dùng, 2026-07-16 — cột "Ghi chú" ở trang quản lý Check in GPS).
ALTER TABLE "checkin_records" ADD COLUMN "note" VARCHAR(500);

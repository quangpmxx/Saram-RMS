-- Lịch gọi lại lặp "Mỗi ngày" (yêu cầu người dùng 2026-10-29). CHỈ THÊM 1 cột,
-- mặc định false = "Một lần" như mọi lịch cũ.
-- AlterTable
ALTER TABLE "callback_schedules" ADD COLUMN "repeat_daily" BOOLEAN NOT NULL DEFAULT false;

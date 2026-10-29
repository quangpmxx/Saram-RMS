-- Xoá lịch hẹn từ module Lịch hẹn (yêu cầu người dùng 2026-10-29) — XOÁ MỀM:
-- chỉ đánh dấu thời điểm + người xoá, giữ nguyên dòng dữ liệu (không mất lịch sử).
-- AlterTable
ALTER TABLE "interview_appointments" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by" UUID;

-- AlterTable
ALTER TABLE "callback_schedules" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by" UUID;

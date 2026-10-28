-- Kho chăm sóc: Sale đề nghị dừng chăm sóc phải chờ Leader/Quản lý/Admin duyệt
-- (yêu cầu người dùng 2026-10-28). CHỈ THÊM MỚI: 2 cột rỗng được + 2 loại thông báo.
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'care_stop_requested';
ALTER TYPE "notification_type" ADD VALUE 'care_stop_decided';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "care_stop_requested_at" TIMESTAMP(3),
ADD COLUMN     "care_stop_requested_by" UUID;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_care_stop_requested_by_fkey" FOREIGN KEY ("care_stop_requested_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


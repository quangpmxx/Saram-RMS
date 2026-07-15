-- AlterEnum (Check in GPS — Phase 4, Mục 9: log riêng "Check in bị từ chối")
ALTER TYPE "audit_action_type" ADD VALUE 'reject';

-- AlterTable checkin_records: thêm voided/reset (Phase 4, Mục 8).
ALTER TABLE "checkin_records" ADD COLUMN "is_voided" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "checkin_records" ADD COLUMN "voided_at" TIMESTAMP(3);
ALTER TABLE "checkin_records" ADD COLUMN "voided_by" UUID;
ALTER TABLE "checkin_records" ADD COLUMN "void_reason" VARCHAR(500);

ALTER TABLE "checkin_records" ADD CONSTRAINT "checkin_records_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Thay unique constraint TOÀN CỤC (account_id, attendance_date) bằng
-- PARTIAL UNIQUE INDEX chỉ áp dụng cho bản ghi CHƯA bị voided — cho phép
-- 1 nhân viên có NHIỀU bản ghi cùng ngày miễn là tối đa 1 bản ghi đang
-- "active" (is_voided = false), để Admin Reset xong nhân viên Check in lại
-- được trong khi vẫn giữ nguyên lịch sử bản ghi cũ (Mục 8, yêu cầu người
-- dùng: "Không xóa cứng bản ghi và không làm mất lịch sử").
DROP INDEX "checkin_records_account_id_attendance_date_key";

CREATE INDEX "checkin_records_account_id_attendance_date_idx" ON "checkin_records"("account_id", "attendance_date");

CREATE UNIQUE INDEX "checkin_records_active_account_date_key" ON "checkin_records"("account_id", "attendance_date") WHERE "is_voided" = false;

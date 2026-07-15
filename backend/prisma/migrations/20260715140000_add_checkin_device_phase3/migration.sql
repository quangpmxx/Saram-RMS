-- AlterTable checkin_records: thêm IP/thiết bị/trình duyệt (Phase 3, Mục 5).
-- Nullable — suy ra từ header request, thiếu thì gắn "Cần xác minh" chứ
-- không chặn Check in (Mục 9), nên không cần backfill/DROP DEFAULT.
ALTER TABLE "checkin_records" ADD COLUMN "ip_address" VARCHAR(64);
ALTER TABLE "checkin_records" ADD COLUMN "user_agent" VARCHAR(500);
ALTER TABLE "checkin_records" ADD COLUMN "device" VARCHAR(50);
ALTER TABLE "checkin_records" ADD COLUMN "operating_system" VARCHAR(50);
ALTER TABLE "checkin_records" ADD COLUMN "browser" VARCHAR(50);

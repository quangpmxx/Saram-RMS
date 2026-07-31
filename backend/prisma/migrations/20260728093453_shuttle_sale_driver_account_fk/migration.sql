-- Chuyển "Sale"/"Đưa đón" (shuttle_records.sale/driver, text tự do) sang
-- khóa ngoại thật tới accounts (role 'sale'/'shuttle_staff'). Tại thời điểm
-- migrate, bảng shuttle_records đang RỖNG (0 dòng) nên không cần backfill.

ALTER TABLE "shuttle_records" ADD COLUMN "sale_user_id" UUID;
ALTER TABLE "shuttle_records" ADD COLUMN "driver_user_id" UUID;

ALTER TABLE "shuttle_records" DROP COLUMN "sale";
ALTER TABLE "shuttle_records" DROP COLUMN "driver";

ALTER TABLE "shuttle_records"
  ADD CONSTRAINT "shuttle_records_sale_user_id_fkey"
  FOREIGN KEY ("sale_user_id") REFERENCES "accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shuttle_records"
  ADD CONSTRAINT "shuttle_records_driver_user_id_fkey"
  FOREIGN KEY ("driver_user_id") REFERENCES "accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "shuttle_records_sale_user_id_idx" ON "shuttle_records"("sale_user_id");
CREATE INDEX "shuttle_records_driver_user_id_idx" ON "shuttle_records"("driver_user_id");

-- Dọn gợi ý cũ của 2 trường "sale"/"driver" — cơ chế màu giờ khóa theo
-- account id thay vì tên chuỗi tự gõ, các dòng cũ (tham chiếu tài khoản đã
-- bị xóa từ đợt dọn dữ liệu trước) không còn khớp với tài khoản thật nào.
DELETE FROM "shuttle_options" WHERE "field" IN ('sale', 'driver');

-- Nhập DS/Thưởng: DS Media / DS Tuyển dụng / DS Đưa đón dùng chung bảng với DS Sale (2026-11-12).
-- kind: sale | media | recruitment | shuttle. Dòng cũ đều là DS Sale.
ALTER TABLE "sales_entry_records"
  ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'sale',
  ADD COLUMN "work_status" VARCHAR(255),
  ADD COLUMN "check_user_id" UUID,
  ADD COLUMN "total_days" DECIMAL(6,1),
  ADD COLUMN "total_hours" DECIMAL(7,1);

CREATE INDEX "sales_entry_records_kind_idx" ON "sales_entry_records"("kind");

CREATE INDEX "sales_entry_records_check_user_id_idx" ON "sales_entry_records"("check_user_id");

ALTER TABLE "sales_entry_records" ADD CONSTRAINT "sales_entry_records_check_user_id_fkey" FOREIGN KEY ("check_user_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

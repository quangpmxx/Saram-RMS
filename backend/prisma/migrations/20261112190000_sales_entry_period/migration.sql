-- Nhập DS/Thưởng: bộ lọc Tháng/Năm như Chấm công (2026-11-12) — mỗi dòng thuộc 1 kỳ (tháng/năm).
-- Dòng cũ: lấy theo ngày tạo, giờ Việt Nam (created_at lưu UTC).
ALTER TABLE "sales_entry_records"
  ADD COLUMN "period_year" INTEGER,
  ADD COLUMN "period_month" SMALLINT;

UPDATE "sales_entry_records"
SET "period_year" = EXTRACT(YEAR FROM ("created_at" + INTERVAL '7 hours'))::int,
    "period_month" = EXTRACT(MONTH FROM ("created_at" + INTERVAL '7 hours'))::int;

ALTER TABLE "sales_entry_records"
  ALTER COLUMN "period_year" SET NOT NULL,
  ALTER COLUMN "period_month" SET NOT NULL;

CREATE INDEX "sales_entry_records_kind_period_year_period_month_idx" ON "sales_entry_records"("kind", "period_year", "period_month");

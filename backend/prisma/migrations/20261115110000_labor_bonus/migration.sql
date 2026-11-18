ALTER TYPE "notification_type" ADD VALUE 'labor_bonus_paid';

-- Thưởng lao động (2026-11-15): chia 4 bộ phận + ghi người chi thưởng.
ALTER TABLE "sales_entry_records"
  ADD COLUMN "bonus_group" VARCHAR(20),
  ADD COLUMN "paid_by" UUID;

ALTER TABLE "sales_entry_records" ADD CONSTRAINT "sales_entry_records_paid_by_fkey"
  FOREIGN KEY ("paid_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Danh sách thưởng cũ (một danh sách chung, cột Sale) → bộ phận Sale.
UPDATE "sales_entry_records" SET "bonus_group" = 'sale' WHERE "kind" = 'bonus';

CREATE INDEX "sales_entry_records_kind_bonus_group_idx" ON "sales_entry_records"("kind", "bonus_group");

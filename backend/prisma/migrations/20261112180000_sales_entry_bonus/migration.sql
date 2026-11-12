-- Nhập DS/Thưởng: tab Nhập thưởng (kind = bonus) — danh sách thưởng để Kế toán chi (2026-11-12).
ALTER TABLE "sales_entry_records"
  ADD COLUMN "amount" DECIMAL(14,0),
  ADD COLUMN "bank_account_number" VARCHAR(50),
  ADD COLUMN "bank_account_name" VARCHAR(150),
  ADD COLUMN "bank_name" VARCHAR(100),
  ADD COLUMN "referrer_name" VARCHAR(150),
  ADD COLUMN "paid_date" DATE;

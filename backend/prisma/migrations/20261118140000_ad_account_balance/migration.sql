-- Marketing Hub: số dư giới hạn chi tiêu TKQC + cảnh báo khi tụt dưới mốc (2026-11-18).
ALTER TYPE "notification_type" ADD VALUE 'ad_balance_low';
ALTER TABLE "ad_accounts" ADD COLUMN "spend_cap" DECIMAL(18,2),
  ADD COLUMN "amount_spent" DECIMAL(18,2),
  ADD COLUMN "balance_alert_level" INTEGER;

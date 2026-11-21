-- Tra thẳng từng mã quảng cáo (2026-11-21): quảng cáo của TKQC chưa liên kết vẫn lưu được tên camp.
ALTER TABLE "fb_ads" ALTER COLUMN "ad_account_id" DROP NOT NULL;
ALTER TABLE "fb_ads" ADD COLUMN "last_error" VARCHAR(255);

-- Nhóm quảng cáo (ad set) của quảng cáo — hiển thị thay cho tên camp (2026-11-21).
ALTER TABLE "fb_ads" ADD COLUMN "adset_id" VARCHAR(64);
ALTER TABLE "fb_ads" ADD COLUMN "adset_name" VARCHAR(255);

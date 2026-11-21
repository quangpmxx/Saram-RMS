-- Quảng cáo Facebook của TKQC đã liên kết: tra mã quảng cáo ra camp (2026-11-21).
CREATE TABLE "fb_ads" (
    "ad_id" VARCHAR(64) NOT NULL,
    "ad_account_id" UUID NOT NULL,
    "campaign_id" VARCHAR(64),
    "campaign_name" VARCHAR(255),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fb_ads_pkey" PRIMARY KEY ("ad_id")
);

CREATE INDEX "fb_ads_ad_account_id_idx" ON "fb_ads"("ad_account_id");

-- Tra camp theo data: tìm hội thoại Pancake theo lead.
CREATE INDEX "pancake_conversations_lead_id_idx" ON "pancake_conversations"("lead_id");

ALTER TABLE "fb_ads" ADD CONSTRAINT "fb_ads_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

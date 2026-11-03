-- Marketing Hub: bảng Hiệu quả Marketing. Chỉ THÊM.
ALTER TABLE "ad_accounts" ADD COLUMN "mkt_source_id" UUID;
ALTER TABLE "ad_accounts" ADD COLUMN "fb_account_status" SMALLINT;
ALTER TABLE "ad_accounts" ADD COLUMN "has_active_campaign" BOOLEAN;
CREATE UNIQUE INDEX "ad_accounts_mkt_source_id_key" ON "ad_accounts"("mkt_source_id");
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_mkt_source_id_fkey" FOREIGN KEY ("mkt_source_id") REFERENCES "mkt_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "mkt_cost_thresholds" (
    "id" UUID NOT NULL,
    "green_max" INTEGER NOT NULL,
    "red_min" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mkt_cost_thresholds_pkey" PRIMARY KEY ("id")
);

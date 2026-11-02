-- Marketing Hub: tài khoản quảng cáo liên kết bằng token + chi tiêu theo ngày. Chỉ THÊM bảng/enum mới.
CREATE TYPE "ad_platform" AS ENUM ('facebook', 'tiktok');
CREATE TYPE "ad_account_status" AS ENUM ('connected', 'error', 'disconnected');

CREATE TABLE "ad_accounts" (
    "id" UUID NOT NULL,
    "platform" "ad_platform" NOT NULL,
    "external_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "owner_id" UUID NOT NULL,
    "encrypted_token" TEXT,
    "status" "ad_account_status" NOT NULL DEFAULT 'connected',
    "last_sync_at" TIMESTAMP(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_spend_daily" (
    "id" UUID NOT NULL,
    "ad_account_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(18,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_spend_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ad_accounts_platform_external_id_key" ON "ad_accounts"("platform", "external_id");
CREATE INDEX "ad_accounts_owner_id_idx" ON "ad_accounts"("owner_id");
CREATE UNIQUE INDEX "ad_spend_daily_ad_account_id_date_key" ON "ad_spend_daily"("ad_account_id", "date");
CREATE INDEX "ad_spend_daily_date_idx" ON "ad_spend_daily"("date");

ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ad_spend_daily" ADD CONSTRAINT "ad_spend_daily_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

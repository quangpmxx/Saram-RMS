-- Pancake: page liên kết, hội thoại đã thấy, cài đặt Up tự động. Chỉ THÊM bảng mới.

-- CreateTable
CREATE TABLE "pancake_pages" (
    "id" UUID NOT NULL,
    "page_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "owner_id" UUID NOT NULL,
    "mkt_source_id" UUID,
    "encrypted_token" TEXT,
    "status" "ad_account_status" NOT NULL DEFAULT 'connected',
    "cursor_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancake_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancake_conversations" (
    "id" UUID NOT NULL,
    "pancake_page_id" UUID NOT NULL,
    "conversation_id" VARCHAR(128) NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "phone_number" VARCHAR(20),
    "phone_seen_at" TIMESTAMP(3),
    "lead_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pancake_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancake_auto_up_config" (
    "id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancake_auto_up_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancake_auto_up_teams" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "weight" SMALLINT NOT NULL,
    "order_index" SMALLINT NOT NULL,

    CONSTRAINT "pancake_auto_up_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pancake_pages_page_id_key" ON "pancake_pages"("page_id");

-- CreateIndex
CREATE INDEX "pancake_conversations_pancake_page_id_started_at_idx" ON "pancake_conversations"("pancake_page_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "pancake_conversations_pancake_page_id_conversation_id_key" ON "pancake_conversations"("pancake_page_id", "conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "pancake_auto_up_teams_team_id_key" ON "pancake_auto_up_teams"("team_id");

-- AddForeignKey
ALTER TABLE "pancake_pages" ADD CONSTRAINT "pancake_pages_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancake_pages" ADD CONSTRAINT "pancake_pages_mkt_source_id_fkey" FOREIGN KEY ("mkt_source_id") REFERENCES "mkt_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancake_conversations" ADD CONSTRAINT "pancake_conversations_pancake_page_id_fkey" FOREIGN KEY ("pancake_page_id") REFERENCES "pancake_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancake_conversations" ADD CONSTRAINT "pancake_conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancake_auto_up_teams" ADD CONSTRAINT "pancake_auto_up_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "system_configs" (
    "id" UUID NOT NULL,
    "config_key" VARCHAR(100) NOT NULL,
    "config_value" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_config_key_key" ON "system_configs"("config_key");

-- CreateIndex
CREATE INDEX "leads_assigned_team_id_entered_care_pool_at_idx" ON "leads"("assigned_team_id", "entered_care_pool_at");

-- CreateIndex
CREATE INDEX "leads_is_held_entered_care_pool_at_last_activity_at_idx" ON "leads"("is_held", "entered_care_pool_at", "last_activity_at");

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


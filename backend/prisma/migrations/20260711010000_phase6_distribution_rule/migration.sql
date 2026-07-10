-- CreateTable
CREATE TABLE "auto_distribution_rules" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_assigned_position" SMALLINT NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_distribution_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_distribution_members" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "order_index" SMALLINT NOT NULL,

    CONSTRAINT "auto_distribution_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auto_distribution_rules_team_id_key" ON "auto_distribution_rules"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "auto_distribution_members_rule_id_order_index_key" ON "auto_distribution_members"("rule_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "auto_distribution_members_rule_id_account_id_key" ON "auto_distribution_members"("rule_id", "account_id");

-- AddForeignKey
ALTER TABLE "auto_distribution_rules" ADD CONSTRAINT "auto_distribution_rules_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_distribution_rules" ADD CONSTRAINT "auto_distribution_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_distribution_members" ADD CONSTRAINT "auto_distribution_members_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "auto_distribution_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_distribution_members" ADD CONSTRAINT "auto_distribution_members_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


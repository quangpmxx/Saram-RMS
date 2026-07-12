-- CreateTable
CREATE TABLE "column_width_configs" (
    "id" UUID NOT NULL,
    "table_key" VARCHAR(100) NOT NULL,
    "column_widths" VARCHAR(2000) NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "column_width_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "column_width_configs_table_key_key" ON "column_width_configs"("table_key");

-- AddForeignKey
ALTER TABLE "column_width_configs" ADD CONSTRAINT "column_width_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

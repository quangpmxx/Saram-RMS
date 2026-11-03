-- Marketing Hub: danh mục Nguồn MKT + cột tuỳ chọn trên leads. Chỉ THÊM.
CREATE TABLE "mkt_sources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mkt_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mkt_sources_name_key" ON "mkt_sources"("name");

ALTER TABLE "leads" ADD COLUMN "mkt_source_id" UUID;
ALTER TABLE "leads" ADD CONSTRAINT "leads_mkt_source_id_fkey" FOREIGN KEY ("mkt_source_id") REFERENCES "mkt_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

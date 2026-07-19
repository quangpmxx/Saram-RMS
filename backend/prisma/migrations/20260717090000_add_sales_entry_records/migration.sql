-- CreateTable
CREATE TABLE "sales_entry_records" (
    "id" UUID NOT NULL,
    "employee_code" VARCHAR(50),
    "full_name" VARCHAR(150),
    "date_of_birth" DATE,
    "identity_number" VARCHAR(20),
    "hometown" VARCHAR(255),
    "join_date" DATE,
    "company_id" UUID,
    "sale_user_id" UUID,
    "pickup_user_id" UUID,
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_entry_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_entry_records_full_name_idx" ON "sales_entry_records"("full_name");

-- CreateIndex
CREATE INDEX "sales_entry_records_employee_code_idx" ON "sales_entry_records"("employee_code");

-- CreateIndex
CREATE INDEX "sales_entry_records_identity_number_idx" ON "sales_entry_records"("identity_number");

-- CreateIndex
CREATE INDEX "sales_entry_records_join_date_idx" ON "sales_entry_records"("join_date");

-- CreateIndex
CREATE INDEX "sales_entry_records_company_id_idx" ON "sales_entry_records"("company_id");

-- CreateIndex
CREATE INDEX "sales_entry_records_sale_user_id_idx" ON "sales_entry_records"("sale_user_id");

-- CreateIndex
CREATE INDEX "sales_entry_records_pickup_user_id_idx" ON "sales_entry_records"("pickup_user_id");

-- AddForeignKey
ALTER TABLE "sales_entry_records" ADD CONSTRAINT "sales_entry_records_sale_user_id_fkey" FOREIGN KEY ("sale_user_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_entry_records" ADD CONSTRAINT "sales_entry_records_pickup_user_id_fkey" FOREIGN KEY ("pickup_user_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_entry_records" ADD CONSTRAINT "sales_entry_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_entry_records" ADD CONSTRAINT "sales_entry_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

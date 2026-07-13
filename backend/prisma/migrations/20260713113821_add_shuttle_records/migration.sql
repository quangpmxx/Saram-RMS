-- CreateTable
CREATE TABLE "shuttle_records" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "gender" VARCHAR(20),
    "company" VARCHAR(150),
    "area" VARCHAR(150),
    "type" VARCHAR(100),
    "sale" VARCHAR(150),
    "driver" VARCHAR(150),
    "interview_time" VARCHAR(5),
    "contractor" VARCHAR(150),
    "status" VARCHAR(50),
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shuttle_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shuttle_records_date_idx" ON "shuttle_records"("date");

-- CreateIndex
CREATE INDEX "shuttle_records_status_idx" ON "shuttle_records"("status");

-- AddForeignKey
ALTER TABLE "shuttle_records" ADD CONSTRAINT "shuttle_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shuttle_records" ADD CONSTRAINT "shuttle_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

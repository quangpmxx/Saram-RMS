-- Bảng công tháng gửi nhân viên xác nhận (2026-11-14)
ALTER TYPE "notification_type" ADD VALUE 'attendance_sheet';

-- CreateEnum
CREATE TYPE "attendance_sheet_status" AS ENUM ('pending', 'confirmed', 'disputed');

-- CreateTable
CREATE TABLE "attendance_sheets" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "attendance_sheet_status" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3) NOT NULL,
    "sent_by" UUID NOT NULL,
    "responded_at" TIMESTAMP(3),
    "note" VARCHAR(1000),
    "disputed_days" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sheets_account_id_year_month_key" ON "attendance_sheets"("account_id", "year", "month");
CREATE INDEX "attendance_sheets_year_month_idx" ON "attendance_sheets"("year", "month");

-- AddForeignKey
ALTER TABLE "attendance_sheets" ADD CONSTRAINT "attendance_sheets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_sheets" ADD CONSTRAINT "attendance_sheets_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

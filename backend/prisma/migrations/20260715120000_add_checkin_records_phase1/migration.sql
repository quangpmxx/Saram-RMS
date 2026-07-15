-- CreateTable (Check in GPS — Phase 1: chỉ check-in 1 lần/ngày, chưa có GPS/IP/thiết bị/reset)
CREATE TABLE "checkin_records" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checkin_records_account_id_attendance_date_key" ON "checkin_records"("account_id", "attendance_date");

CREATE INDEX "checkin_records_attendance_date_idx" ON "checkin_records"("attendance_date");

CREATE INDEX "checkin_records_account_id_idx" ON "checkin_records"("account_id");

ALTER TABLE "checkin_records" ADD CONSTRAINT "checkin_records_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

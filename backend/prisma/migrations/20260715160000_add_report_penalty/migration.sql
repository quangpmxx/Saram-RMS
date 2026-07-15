-- CreateEnum (Check phạt — vi phạm nộp Báo cáo hằng ngày muộn/không nộp)
CREATE TYPE "report_violation_type" AS ENUM ('late_submission', 'no_submission');

CREATE TYPE "report_violation_status" AS ENUM ('pending', 'confirmed', 'waived', 'supplemented');

-- CreateTable
CREATE TABLE "report_violations" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "deadline_snapshot" TIMESTAMP(3) NOT NULL,
    "actual_submitted_at" TIMESTAMP(3),
    "violation_type" "report_violation_type" NOT NULL,
    "status" "report_violation_status" NOT NULL DEFAULT 'pending',
    "note" VARCHAR(500),
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_violations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_violations_account_id_report_date_violation_type_key" ON "report_violations"("account_id", "report_date", "violation_type");

CREATE INDEX "report_violations_report_date_idx" ON "report_violations"("report_date");

CREATE INDEX "report_violations_account_id_idx" ON "report_violations"("account_id");

ALTER TABLE "report_violations" ADD CONSTRAINT "report_violations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "report_violations" ADD CONSTRAINT "report_violations_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (cấu hình hạn nộp báo cáo — singleton, chỉ Admin xem/sửa)
CREATE TABLE "report_deadline_configs" (
    "id" UUID NOT NULL,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_deadline_configs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "report_deadline_configs" ADD CONSTRAINT "report_deadline_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

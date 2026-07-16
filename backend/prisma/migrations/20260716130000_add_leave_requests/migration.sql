-- CreateEnum
CREATE TYPE "leave_request_status" AS ENUM ('pending_leader', 'pending_admin', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "leave_decision" AS ENUM ('approved', 'rejected');

-- DropForeignKey
ALTER TABLE "checkin_records" DROP CONSTRAINT "checkin_records_voided_by_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "report_violations" DROP CONSTRAINT "report_violations_resolved_by_fkey";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "leave_request_id" UUID;

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "recipient_text" VARCHAR(255),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_count" INTEGER NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "handover_to" VARCHAR(255),
    "status" "leave_request_status" NOT NULL DEFAULT 'pending_leader',
    "leader_decision_by" UUID,
    "leader_decision_at" TIMESTAMP(3),
    "leader_decision" "leave_decision",
    "leader_note" VARCHAR(500),
    "admin_decision_by" UUID,
    "admin_decision_at" TIMESTAMP(3),
    "admin_decision" "leave_decision",
    "admin_note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_requests_account_id_idx" ON "leave_requests"("account_id");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "notifications_leave_request_id_type_idx" ON "notifications"("leave_request_id", "type");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leader_decision_by_fkey" FOREIGN KEY ("leader_decision_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_admin_decision_by_fkey" FOREIGN KEY ("admin_decision_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_violations" ADD CONSTRAINT "report_violations_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_records" ADD CONSTRAINT "checkin_records_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

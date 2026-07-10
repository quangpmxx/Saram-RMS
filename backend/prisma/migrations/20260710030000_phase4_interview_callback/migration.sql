-- CreateTable
CREATE TABLE "interview_appointments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "attempt_no" SMALLINT NOT NULL DEFAULT 1,
    "partner_company_name" VARCHAR(150) NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status_id" UUID NOT NULL,
    "employment_status_id" UUID,
    "employment_reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "callback_schedules" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "callback_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_appointments_lead_id_idx" ON "interview_appointments"("lead_id");

-- CreateIndex
CREATE INDEX "interview_appointments_scheduled_at_idx" ON "interview_appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX "callback_schedules_lead_id_idx" ON "callback_schedules"("lead_id");

-- CreateIndex
CREATE INDEX "callback_schedules_scheduled_at_idx" ON "callback_schedules"("scheduled_at");

-- AddForeignKey
ALTER TABLE "interview_appointments" ADD CONSTRAINT "interview_appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_appointments" ADD CONSTRAINT "interview_appointments_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "status_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_appointments" ADD CONSTRAINT "interview_appointments_employment_status_id_fkey" FOREIGN KEY ("employment_status_id") REFERENCES "status_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_appointments" ADD CONSTRAINT "interview_appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callback_schedules" ADD CONSTRAINT "callback_schedules_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callback_schedules" ADD CONSTRAINT "callback_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


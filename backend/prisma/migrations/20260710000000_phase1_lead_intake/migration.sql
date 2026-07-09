-- CreateEnum
CREATE TYPE "status_category" AS ENUM ('call_status', 'call_result', 'interview_status', 'employment_status');

-- CreateEnum
CREATE TYPE "assignment_method" AS ENUM ('manual', 'auto');

-- CreateEnum
CREATE TYPE "import_job_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_catalog" (
    "id" UUID NOT NULL,
    "category" "status_category" NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "status_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "birth_year" SMALLINT,
    "address" VARCHAR(255),
    "source_id" UUID NOT NULL,
    "mkt_note" TEXT,
    "data_quality_score" SMALLINT,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_to" UUID,
    "assigned_team_id" UUID,
    "assigned_at" TIMESTAMP(3),
    "assignment_method" "assignment_method",
    "call_status_id" UUID,
    "call_result_id" UUID,
    "current_interview_status_id" UUID,
    "current_employment_status_id" UUID,
    "current_partner_company_name" VARCHAR(150),
    "is_held" BOOLEAN NOT NULL DEFAULT false,
    "held_by" UUID,
    "held_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "entered_care_pool_at" TIMESTAMP(3),
    "care_pool_locked_by" UUID,
    "care_pool_locked_at" TIMESTAMP(3),
    "removed_from_care_pool_by" UUID,
    "removed_from_care_pool_at" TIMESTAMP(3),
    "is_duplicate_flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_name" VARCHAR(255),
    "status" "import_job_status" NOT NULL DEFAULT 'pending',
    "total_rows" INTEGER,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_name_key" ON "lead_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "status_catalog_category_code_key" ON "status_catalog"("category", "code");

-- CreateIndex
CREATE INDEX "leads_phone_number_idx" ON "leads"("phone_number");

-- CreateIndex
CREATE INDEX "leads_uploaded_at_idx" ON "leads"("uploaded_at");

-- CreateIndex
CREATE INDEX "leads_deleted_at_idx" ON "leads"("deleted_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_held_by_fkey" FOREIGN KEY ("held_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_care_pool_locked_by_fkey" FOREIGN KEY ("care_pool_locked_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_removed_from_care_pool_by_fkey" FOREIGN KEY ("removed_from_care_pool_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_call_status_id_fkey" FOREIGN KEY ("call_status_id") REFERENCES "status_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_call_result_id_fkey" FOREIGN KEY ("call_result_id") REFERENCES "status_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_current_interview_status_id_fkey" FOREIGN KEY ("current_interview_status_id") REFERENCES "status_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_current_employment_status_id_fkey" FOREIGN KEY ("current_employment_status_id") REFERENCES "status_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


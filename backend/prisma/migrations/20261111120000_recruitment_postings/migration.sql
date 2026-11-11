-- Lịch tuyển dụng (2026-11-11): thẻ tuyển dụng của từng công ty (thay sheet "Lịch tuyển dụng").
CREATE TYPE "recruitment_kind" AS ENUM ('official', 'seasonal');
CREATE TYPE "recruitment_status" AS ENUM ('open', 'limited', 'paused');

CREATE TABLE "recruitment_postings" (
    "id" UUID NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "order_record_id" UUID,
    "kind" "recruitment_kind" NOT NULL DEFAULT 'official',
    "status" "recruitment_status" NOT NULL DEFAULT 'open',
    "area" VARCHAR(100),
    "accept_male" BOOLEAN NOT NULL DEFAULT true,
    "accept_female" BOOLEAN NOT NULL DEFAULT true,
    "age_min" INTEGER,
    "age_max" INTEGER,
    "requirement" TEXT,
    "base_salary" INTEGER,
    "allowance" INTEGER,
    "salary_note" TEXT,
    "bonus_summary" VARCHAR(255),
    "bonus" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interview_slot" TEXT,
    "work" TEXT,
    "documents" TEXT,
    "housing" TEXT,
    "pros" TEXT,
    "cons" TEXT,
    "notes" TEXT,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_postings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recruitment_postings_kind_idx" ON "recruitment_postings"("kind");

ALTER TABLE "recruitment_postings" ADD CONSTRAINT "recruitment_postings_order_record_id_fkey" FOREIGN KEY ("order_record_id") REFERENCES "order_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_postings" ADD CONSTRAINT "recruitment_postings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

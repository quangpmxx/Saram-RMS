-- AlterTable
ALTER TABLE "shuttle_records" ADD COLUMN "interview_result" VARCHAR(50);

-- CreateIndex
CREATE INDEX "shuttle_records_interview_result_idx" ON "shuttle_records"("interview_result");

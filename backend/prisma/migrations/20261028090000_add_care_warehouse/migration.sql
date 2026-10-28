-- Kho chăm sóc (2026-10-28, yêu cầu trực tiếp người dùng). CHỈ THÊM MỚI:
-- 2 cột rỗng được trên leads ("Dừng chăm sóc") + 2 bảng lịch sử phân công
-- care_assignment_batches/care_assignments. Không sửa/xóa dữ liệu cũ nào.
-- CreateEnum
CREATE TYPE "care_assignment_method" AS ENUM ('manual', 'random', 'self');

-- CreateEnum
CREATE TYPE "care_assignment_end_reason" AS ENUM ('revoked', 'reassigned', 'stopped');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "care_stopped_at" TIMESTAMP(3),
ADD COLUMN     "care_stopped_by" UUID;

-- CreateTable
CREATE TABLE "care_assignment_batches" (
    "id" UUID NOT NULL,
    "method" "care_assignment_method" NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lead_count" INTEGER NOT NULL,

    CONSTRAINT "care_assignment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_assignments" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "assignee_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "ended_by" UUID,
    "end_reason" "care_assignment_end_reason",

    CONSTRAINT "care_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_assignment_batches_created_at_idx" ON "care_assignment_batches"("created_at");

-- CreateIndex
CREATE INDEX "care_assignments_lead_id_assigned_at_idx" ON "care_assignments"("lead_id", "assigned_at");

-- CreateIndex
CREATE INDEX "care_assignments_assignee_id_assigned_at_idx" ON "care_assignments"("assignee_id", "assigned_at");

-- CreateIndex
CREATE INDEX "care_assignments_batch_id_idx" ON "care_assignments"("batch_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_care_stopped_by_fkey" FOREIGN KEY ("care_stopped_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignment_batches" ADD CONSTRAINT "care_assignment_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "care_assignment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_ended_by_fkey" FOREIGN KEY ("ended_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


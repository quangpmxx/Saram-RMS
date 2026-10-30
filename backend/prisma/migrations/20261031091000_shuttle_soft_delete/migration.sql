-- Đưa đón xoá mềm (rà soát 2026-10-30) — chỉ thêm cột, dữ liệu cũ giữ nguyên.
-- AlterTable
ALTER TABLE "shuttle_records" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" UUID;


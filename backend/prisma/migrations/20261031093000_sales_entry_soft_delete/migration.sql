-- DS Sale xoá mềm (rà soát 2026-10-30) — chỉ thêm cột, dữ liệu cũ giữ nguyên.
-- AlterTable
ALTER TABLE "sales_entry_records" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" UUID;

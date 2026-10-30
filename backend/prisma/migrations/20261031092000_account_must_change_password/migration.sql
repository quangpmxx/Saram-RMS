-- Bắt đổi mật khẩu (rà soát 2026-10-30) — chỉ thêm cột, mặc định false.
-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;


-- Admin xoá tài khoản đã vô hiệu hoá (2026-11-09): ẩn tài khoản, giữ lịch sử.
ALTER TABLE "accounts" ADD COLUMN "deleted_at" TIMESTAMP(3);

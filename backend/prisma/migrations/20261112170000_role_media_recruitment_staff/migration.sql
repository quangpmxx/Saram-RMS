-- Thêm 2 vị trí: NV Media, NV Tuyển dụng (2026-11-12).
ALTER TYPE "account_role" ADD VALUE IF NOT EXISTS 'media_staff';
ALTER TYPE "account_role" ADD VALUE IF NOT EXISTS 'recruitment_staff';

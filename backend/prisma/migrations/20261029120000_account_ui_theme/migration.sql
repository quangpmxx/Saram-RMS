-- Giao diện Sáng/Tối riêng từng tài khoản (yêu cầu người dùng 2026-10-29).
-- CHỈ THÊM 1 cột, mặc định 'light' (giao diện hiện tại) cho mọi tài khoản cũ.
-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "ui_theme" VARCHAR(10) NOT NULL DEFAULT 'light';

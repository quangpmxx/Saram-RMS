-- AlterTable accounts: bổ sung CCCD + STK (yêu cầu trực tiếp người dùng, 2026-07-15)
ALTER TABLE "accounts" ADD COLUMN "citizen_id" VARCHAR(20);
ALTER TABLE "accounts" ADD COLUMN "bank_account_number" VARCHAR(30);

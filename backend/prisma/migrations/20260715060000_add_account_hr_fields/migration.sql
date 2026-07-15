-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "date_of_birth" DATE;
ALTER TABLE "accounts" ADD COLUMN "hire_date" DATE;
ALTER TABLE "accounts" ADD COLUMN "personal_phone" VARCHAR(20);
ALTER TABLE "accounts" ADD COLUMN "personal_email" VARCHAR(255);
ALTER TABLE "accounts" ADD COLUMN "remaining_leave_days" DOUBLE PRECISION;

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'admin_message';

-- AlterEnum
ALTER TYPE "notification_channel" ADD VALUE 'in_app';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "content" TEXT;

-- AlterEnum
ALTER TYPE "status_category" ADD VALUE 'zalo_friend_status';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "zalo_friend_status_id" UUID;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_zalo_friend_status_id_fkey" FOREIGN KEY ("zalo_friend_status_id") REFERENCES "status_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

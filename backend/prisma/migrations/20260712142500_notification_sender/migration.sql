-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "sender_id" UUID;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

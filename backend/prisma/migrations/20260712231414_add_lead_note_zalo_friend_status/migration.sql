-- AlterTable
ALTER TABLE "lead_notes" ADD COLUMN "zalo_friend_status_id" UUID;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_zalo_friend_status_id_fkey" FOREIGN KEY ("zalo_friend_status_id") REFERENCES "status_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

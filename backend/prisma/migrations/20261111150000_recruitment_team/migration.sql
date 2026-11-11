-- Lịch tuyển dụng: mỗi nhóm một lịch riêng. Thẻ đã nhập sẵn để trống nhóm, Admin gán nhóm trên giao diện.
ALTER TABLE "recruitment_postings" ADD COLUMN "team_id" UUID;
CREATE INDEX "recruitment_postings_team_id_idx" ON "recruitment_postings"("team_id");
ALTER TABLE "recruitment_postings" ADD CONSTRAINT "recruitment_postings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Admin chọn cho tài khoản xem lịch tuyển của 1 nhóm nhất định (trống = theo nhóm của tài khoản).
ALTER TABLE "accounts" ADD COLUMN "recruitment_team_id" UUID;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_recruitment_team_id_fkey" FOREIGN KEY ("recruitment_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

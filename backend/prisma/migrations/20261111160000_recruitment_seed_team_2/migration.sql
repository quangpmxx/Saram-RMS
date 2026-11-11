-- Lịch tuyển dụng: 94 thẻ nhập sẵn từ sheet là lịch của Nhóm 2 (user xác nhận 2026-11-11).
-- Không tìm thấy nhóm tên "Nhóm 2" thì giữ nguyên chưa gán nhóm (Admin gán trên giao diện).
UPDATE "recruitment_postings"
SET "team_id" = (SELECT "id" FROM "teams" WHERE lower(trim("name")) = lower('Nhóm 2') ORDER BY "created_at" ASC LIMIT 1)
WHERE "team_id" IS NULL
  AND EXISTS (SELECT 1 FROM "teams" WHERE lower(trim("name")) = lower('Nhóm 2'));

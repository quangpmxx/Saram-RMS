-- Chọn bài hiển thị ở bảng "Ghi chú khi up số theo bài" (yêu cầu người dùng 2026-11-08): chỉ bài được
-- chọn mới hiện + mới áp ghi chú; ghi chú có thể trống. Bài đã có ghi chú trước đó coi như đã chọn.
ALTER TABLE "pancake_post_notes" ALTER COLUMN "up_note" DROP NOT NULL;
ALTER TABLE "pancake_post_notes" ADD COLUMN "is_selected" BOOLEAN NOT NULL DEFAULT false;
UPDATE "pancake_post_notes" SET "is_selected" = true;

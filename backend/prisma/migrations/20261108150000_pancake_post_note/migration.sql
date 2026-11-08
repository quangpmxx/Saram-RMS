-- Ghi chú khi up số theo BÀI (yêu cầu người dùng 2026-11-08): lưu bài (post) của hội thoại —
-- bài của quảng cáo khách bấm (inbox) hoặc bài khách bình luận; ghi chú theo bài ưu tiên hơn ghi chú page.
ALTER TABLE "pancake_conversations" ADD COLUMN "post_id" VARCHAR(128);
ALTER TABLE "pancake_conversations" ADD COLUMN "ad_id" VARCHAR(64);
CREATE INDEX "pancake_conversations_post_id_idx" ON "pancake_conversations"("post_id");

CREATE TABLE "pancake_post_notes" (
    "post_id" VARCHAR(128) NOT NULL,
    "pancake_page_id" UUID NOT NULL,
    "up_note" VARCHAR(500) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancake_post_notes_pkey" PRIMARY KEY ("post_id")
);

ALTER TABLE "pancake_post_notes" ADD CONSTRAINT "pancake_post_notes_pancake_page_id_fkey" FOREIGN KEY ("pancake_page_id") REFERENCES "pancake_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

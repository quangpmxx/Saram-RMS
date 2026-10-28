-- Đơn phản ánh ẩn danh (2026-10-28, yêu cầu trực tiếp người dùng). CHỈ THÊM MỚI:
-- bảng anonymous_feedbacks + 1 giá trị notification_type. Không sửa/xóa dữ liệu cũ.
-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'anonymous_feedback_created';

-- CreateTable
CREATE TABLE "anonymous_feedbacks" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient" VARCHAR(200) NOT NULL,
    "subject" VARCHAR(300) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anonymous_feedbacks_created_at_idx" ON "anonymous_feedbacks"("created_at");

-- AddForeignKey
ALTER TABLE "anonymous_feedbacks" ADD CONSTRAINT "anonymous_feedbacks_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


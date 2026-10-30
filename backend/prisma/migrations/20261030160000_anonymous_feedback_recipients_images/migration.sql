-- Đơn phản ánh ẩn danh: chọn người nhận (rỗng = tất cả Admin + Quản lý) và ảnh đính kèm.
-- AlterTable
ALTER TABLE "anonymous_feedbacks" ADD COLUMN     "image_files" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "recipient_ids" UUID[] DEFAULT ARRAY[]::UUID[];

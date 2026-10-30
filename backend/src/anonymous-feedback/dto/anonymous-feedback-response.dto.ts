import { AnonymousFeedback } from '../../../generated/prisma/client';

export interface AnonymousFeedbackRecipientDto {
  id: string;
  full_name: string;
  role: string;
}

/**
 * Đơn phản ánh ẩn danh trả cho Quản lý/Admin. CỐ Ý không có bất kỳ trường
 * nào về người gửi (id, tên, vai trò, nhóm...) — chỉ nội dung đơn.
 */
export interface AnonymousFeedbackResponseDto {
  id: string;
  subject: string;
  content: string;
  /** Người nhận đã chọn — rỗng = gửi tất cả Admin + Quản lý. */
  recipients: AnonymousFeedbackRecipientDto[];
  /** Số ảnh đính kèm — tải từng ảnh qua GET /anonymous-feedback/:id/images/:index. */
  image_count: number;
  created_at: string;
}

export function toAnonymousFeedbackResponse(
  feedback: Pick<
    AnonymousFeedback,
    'id' | 'subject' | 'content' | 'recipientIds' | 'imageFiles' | 'createdAt'
  >,
  recipientsById: Map<string, AnonymousFeedbackRecipientDto>,
): AnonymousFeedbackResponseDto {
  return {
    id: feedback.id,
    subject: feedback.subject,
    content: feedback.content,
    recipients: feedback.recipientIds
      .map((id) => recipientsById.get(id))
      .filter((r): r is AnonymousFeedbackRecipientDto => Boolean(r)),
    image_count: feedback.imageFiles.length,
    created_at: feedback.createdAt.toISOString(),
  };
}

/** Chỉ chọn đúng các cột trả ra ngoài — không bao giờ đọc senderId khi trả dữ liệu. */
export const ANONYMOUS_FEEDBACK_PUBLIC_SELECT = {
  id: true,
  subject: true,
  content: true,
  recipientIds: true,
  imageFiles: true,
  createdAt: true,
} as const;

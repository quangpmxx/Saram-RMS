import { AnonymousFeedback } from '../../../generated/prisma/client';

/**
 * Đơn phản ánh ẩn danh trả cho Quản lý/Admin. CỐ Ý không có bất kỳ trường
 * nào về người gửi (id, tên, vai trò, nhóm...) — chỉ nội dung đơn.
 */
export interface AnonymousFeedbackResponseDto {
  id: string;
  recipient: string;
  subject: string;
  content: string;
  created_at: string;
}

export function toAnonymousFeedbackResponse(
  feedback: Pick<
    AnonymousFeedback,
    'id' | 'recipient' | 'subject' | 'content' | 'createdAt'
  >,
): AnonymousFeedbackResponseDto {
  return {
    id: feedback.id,
    recipient: feedback.recipient,
    subject: feedback.subject,
    content: feedback.content,
    created_at: feedback.createdAt.toISOString(),
  };
}

/** Chỉ chọn đúng các cột trả ra ngoài — không bao giờ đọc senderId khi trả dữ liệu. */
export const ANONYMOUS_FEEDBACK_PUBLIC_SELECT = {
  id: true,
  recipient: true,
  subject: true,
  content: true,
  createdAt: true,
} as const;

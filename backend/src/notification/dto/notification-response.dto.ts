import { Account, Notification } from '../../../generated/prisma/client';

/**
 * Đối tượng "Notification" — Mục 0.1, docs/13-api-design.md: id, account_id,
 * lead_id, type, channel, scheduled_at, sent_at, status (không liệt kê
 * created_at, khác với các đối tượng khác — giữ đúng như tài liệu đã chốt).
 * Dự án phụ — nâng cấp toàn diện: thêm `content` (null với 2 loại nhắc lịch
 * cũ, có giá trị khi type=admin_message — Admin gửi thông báo thủ công) và
 * `sender` (ai đã gửi — chỉ có với type=admin_message, null với 2 loại nhắc
 * lịch cũ vì đó là hệ thống tự tạo, không có người gửi cụ thể).
 */
export interface NotificationResponseDto {
  id: string;
  account_id: string;
  lead_id: string | null;
  type: string;
  channel: string;
  content: string | null;
  sender: {
    id: string;
    name: string;
    role: string;
    avatar_url: string | null;
  } | null;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
}

type NotificationWithSender = Notification & {
  sender?: Pick<Account, 'id' | 'fullName' | 'role' | 'avatarUrl'> | null;
};

export function toNotificationResponse(
  notification: NotificationWithSender,
): NotificationResponseDto {
  return {
    id: notification.id,
    account_id: notification.accountId,
    lead_id: notification.leadId,
    type: notification.type,
    channel: notification.channel,
    content: notification.content,
    sender: notification.sender
      ? {
          id: notification.sender.id,
          name: notification.sender.fullName,
          role: notification.sender.role,
          avatar_url: notification.sender.avatarUrl,
        }
      : null,
    scheduled_at: notification.scheduledAt.toISOString(),
    sent_at: notification.sentAt?.toISOString() ?? null,
    status: notification.status,
  };
}

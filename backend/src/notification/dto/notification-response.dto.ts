import { Notification } from '../../../generated/prisma/client';

/**
 * Đối tượng "Notification" — Mục 0.1, docs/13-api-design.md: id, account_id,
 * lead_id, type, channel, scheduled_at, sent_at, status (không liệt kê
 * created_at, khác với các đối tượng khác — giữ đúng như tài liệu đã chốt).
 */
export interface NotificationResponseDto {
  id: string;
  account_id: string;
  lead_id: string | null;
  type: string;
  channel: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
}

export function toNotificationResponse(
  notification: Notification,
): NotificationResponseDto {
  return {
    id: notification.id,
    account_id: notification.accountId,
    lead_id: notification.leadId,
    type: notification.type,
    channel: notification.channel,
    scheduled_at: notification.scheduledAt.toISOString(),
    sent_at: notification.sentAt?.toISOString() ?? null,
    status: notification.status,
  };
}

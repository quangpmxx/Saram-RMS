import type { NotificationType } from '../../generated/prisma/client';

/**
 * Nhóm "Data" của chuông thông báo (yêu cầu người dùng 2026-11-01): mọi thông
 * báo liên quan đến data (lead) — data mới về nhóm, được chia/giao data, đề
 * nghị dừng chăm sóc, các nhắc lịch gọi lại/phỏng vấn. Mọi loại còn lại thuộc
 * nhóm "Khác". PHẢI khớp frontend/lib/notification-groups.ts.
 */
export const DATA_NOTIFICATION_TYPES: readonly NotificationType[] = [
  'new_data_uploaded',
  'lead_assigned',
  'care_assigned',
  'care_stop_requested',
  'care_stop_decided',
  'callback_reminder',
  'manual_callback_reminder',
  'interview_reminder',
];

/** Giờ Việt Nam là UTC+7 cố định (không có giờ mùa hè). */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mốc hết hạn của thông báo nhóm "Data": 00:00 hôm nay theo giờ Việt Nam. Thông
 * báo Data tạo TRƯỚC mốc này (tức từ hôm qua trở về trước) là đã hết hạn — sang
 * ngày mới là tự hết hạn (yêu cầu người dùng 2026-11-01), không phải đúng 24 giờ.
 */
export function dataNotificationCutoff(now: Date = new Date()): Date {
  const localMs = now.getTime() + VN_OFFSET_MS;
  const startOfLocalDay = Math.floor(localMs / DAY_MS) * DAY_MS;
  return new Date(startOfLocalDay - VN_OFFSET_MS);
}

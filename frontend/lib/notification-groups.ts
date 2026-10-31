import type { AppNotification } from "./types";

/**
 * Chuông thông báo chia 2 phần (yêu cầu người dùng 2026-11-01): "Data" = mọi
 * thông báo liên quan đến data (lead); "Khác" = tất cả còn lại. Thông báo "Data"
 * tự hết hạn khi sang ngày mới (backend tự ẩn + dọn). Danh sách PHẢI khớp
 * backend/src/notification/notification-groups.ts.
 */
export type NotificationGroup = "data" | "other";

const DATA_NOTIFICATION_TYPES: ReadonlySet<AppNotification["type"]> = new Set<AppNotification["type"]>([
  "new_data_uploaded",
  "lead_assigned",
  "care_assigned",
  "care_stop_requested",
  "care_stop_decided",
  "callback_reminder",
  "manual_callback_reminder",
  "interview_reminder",
]);

export function notificationGroup(type: AppNotification["type"]): NotificationGroup {
  return DATA_NOTIFICATION_TYPES.has(type) ? "data" : "other";
}

/**
 * Nội dung thông báo đẩy ra điện thoại — chữ + trang mở khi bấm, KHỚP với
 * chuông thông báo trên web (frontend/components/notification-bell.tsx:
 * TYPE_LABEL + notificationTarget). Thêm loại thông báo mới thì sửa cả 2 nơi.
 */
const TYPE_LABEL: Record<string, string> = {
  callback_reminder: 'Nhắc lịch gọi lại',
  interview_reminder: 'Nhắc lịch phỏng vấn',
  admin_message: 'Thông báo từ Admin/Quản lý',
  new_data_uploaded: 'Data mới về nhóm',
  manual_callback_reminder: 'Nhắc gọi lại',
  leave_request_pending_leader: 'Đơn xin nghỉ phép cần duyệt',
  leave_request_pending_admin: 'Đơn xin nghỉ phép cần duyệt',
  leave_request_decided: 'Kết quả đơn xin nghỉ phép',
  anonymous_feedback_created: 'Đơn phản ánh ẩn danh mới',
  care_stop_requested: 'Đề nghị dừng chăm sóc cần duyệt',
  care_stop_decided: 'Kết quả đề nghị dừng chăm sóc',
  care_assigned: 'Được giao data chăm sóc',
  shuttle_update: 'Danh sách đưa đón',
  lead_assigned: 'Được chia data',
  sale_no_shuttle_reminder: 'Nhắc nhở chưa có người phỏng vấn',
  media_task: 'Công việc Media',
};

export interface PushableNotification {
  id: string;
  type?: string;
  content?: string | null;
  lead_id?: string | null;
  leave_request_id?: string | null;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Đường dẫn trong web mở khi bấm thông báo. */
  url: string;
  /** Cùng tag = thay thế thông báo cũ thay vì chồng thêm. */
  tag: string;
}

function targetUrl(n: PushableNotification): string {
  if (n.lead_id) return `/candidates/${n.lead_id}`;
  if (n.leave_request_id)
    return `/attendance?tab=requests&open=${n.leave_request_id}`;
  if (n.type === 'anonymous_feedback_created')
    return '/attendance?tab=requests&view=feedback';
  if (n.type === 'care_assigned')
    return '/candidates?view=care&care_scope=assigned';
  if (n.type === 'shuttle_update') return '/shuttle';
  if (n.type === 'lead_assigned') return '/candidates';
  if (n.type === 'media_task') return '/media?tab=tasks';
  return '/';
}

export function buildPushMessage(n: PushableNotification): PushMessage {
  const label = (n.type && TYPE_LABEL[n.type]) || 'Thông báo mới';
  const content = n.content?.trim();
  return {
    title: content ? label : 'Saram CRM',
    body: (content || label).slice(0, 300),
    url: targetUrl(n),
    tag: n.id,
  };
}

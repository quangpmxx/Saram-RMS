import { AccountRole } from '../../generated/prisma/client';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — "Mở rộng cơ chế đồng bộ
 * realtime hiện có sang 4 phần: Đưa đón, Báo cáo, Thông báo, Dashboard".
 * Contract TỔNG QUÁT dùng CHUNG cho 4 module này — KHÁC với
 * `LeadRealtimeEvent`/`realtime-event.interface.ts` (giữ nguyên, không đụng
 * — module Data lao động đã hoạt động ổn định, không làm lại). Phát trên 1
 * kênh Socket.IO riêng (`APP_EVENT_NAME`, xem realtime.gateway.ts) — cùng 1
 * kết nối Socket.IO/Gateway/Service DUY NHẤT với leads:update, chỉ khác tên
 * sự kiện và payload, đúng yêu cầu Mục 5 "tái sử dụng connection/service
 * hiện có, không tạo hệ thống WebSocket riêng".
 */
export type AppRealtimeModule =
  | 'transportation'
  | 'daily-report'
  | 'penalty'
  | 'notification'
  | 'dashboard'
  /**
   * Dự án phụ — nâng cấp toàn diện (2026-07-17): "DS Sale" (module con của
   * Nhập doanh số) — chỉ Admin xem được module này (@Roles('admin') ở
   * sales-entry.controller.ts), nên phát `broadcastAll` là an toàn (không
   * lộ rộng hơn quyền thật — không phải Admin thì không mở được trang này
   * nên không có listener nào lắng nghe sự kiện, giống lý luận đã áp dụng
   * cho 'transportation').
   */
  | 'sales-entry';

export type AppRealtimeAction =
  'created' | 'updated' | 'deleted' | 'invalidate';

/**
 * Chỉ dùng NỘI BỘ ở server để tính phòng (room) cần phát tới — không gửi ra
 * ngoài client, giống hệt nguyên tắc của `LeadEventTargets`.
 *
 * - `broadcastAll`: dùng cho Đưa đón — module này KHÔNG có bất kỳ giới hạn
 *   RBAC nào theo bản ghi (đã xác nhận qua code thật: shuttle.controller.ts
 *   không gắn @Roles() ở route nào, shuttle.service.ts.list() không lọc
 *   theo currentUser) — mọi vai trò đã đăng nhập đều xem được mọi dòng, nên
 *   phát cho MỌI kết nối đã xác thực là đúng, không phải lấy rộng hơn quyền
 *   thật.
 * - `leaderOfTeamId`/`accountId`: dùng cho Báo cáo hằng ngày/Check phạt —
 *   khớp đúng RBAC thật (Sale CHỈ xem của chính mình — `accountId`; Leader
 *   xem cả nhóm nhưng KHÔNG phải qua phòng nhóm chung của Data lao động,
 *   vì phòng đó có cả Sale cùng nhóm — dùng `leaderOfTeamId` = phòng riêng
 *   chỉ Leader của đúng nhóm đó tham gia, xem realtime.gateway.ts#leaderRoom).
 * - `adminManagerOnly`: Báo cáo/Check phạt loại MKT khỏi phạm vi xem
 *   (ALLOWED_ROLES/VIEW_ROLES không có 'mkt') — KHÁC với FULL_ACCESS_ROOM
 *   hiện có (dùng cho Data lao động, có gồm MKT) nên cần phòng riêng, không
 *   tái dùng FULL_ACCESS_ROOM kẻo lộ dữ liệu cho MKT.
 */
export interface AppEventTargets {
  broadcastAll?: boolean;
  leaderOfTeamId?: string | null;
  accountId?: string | null;
  adminManagerOnly?: boolean;
}

/** Payload thật sự gửi cho client — chuẩn hóa tối thiểu theo đúng Mục 5 bản yêu cầu. */
export interface AppRealtimeEvent<TPayload = unknown> {
  module: AppRealtimeModule;
  entity: string;
  action: AppRealtimeAction;
  entity_id: string | null;
  updated_at: string;
  actor: { id: string; role: AccountRole } | null;
  payload?: TPayload;
}

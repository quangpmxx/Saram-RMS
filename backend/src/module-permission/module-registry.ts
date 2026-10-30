import type { Type } from '@nestjs/common';
import { AccountRole } from '../../generated/prisma/enums';
import { DashboardController } from '../dashboard/dashboard.controller';
import { ReportController } from '../dashboard/report.controller';
import { CandidatesController } from '../candidates/candidates.controller';
import { ImportsController } from '../imports/imports.controller';
import { InterviewCallbackController } from '../candidates/interview-callback.controller';
import { CarePoolController } from '../care-pool/care-pool.controller';
import { CareWarehouseController } from '../care-warehouse/care-warehouse.controller';
import { CareProgressController } from '../care-warehouse/care-progress.controller';
import { DistributionRuleController } from '../distribution/distribution-rule.controller';
import { ShuttleController } from '../shuttle/shuttle.controller';
import { DailyReportsController } from '../daily-reports/daily-reports.controller';
import { ReportPenaltyController } from '../report-penalty/report-penalty.controller';
import { AttendanceController } from '../attendance/attendance.controller';
import { SalesEntryController } from '../sales-entry/sales-entry.controller';
import { CalendarController } from '../calendar/calendar.controller';
import { AuditLogController } from '../audit-log/audit-log.controller';
import { AccountsController } from '../accounts/accounts.controller';
import { OrderManagementController } from '../order-management/order-management.controller';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Phân quyền" phiên bản đơn
 * giản — nguồn dữ liệu DUY NHẤT ánh xạ 1 module trên sidebar sang các
 * controller thật sự phục vụ trang đó. `ModulePermissionGuard` tra cứu
 * bảng này theo `context.getClass()` — KHÔNG cần gắn decorator vào từng
 * controller (không đụng file controller nào đang chạy ổn định).
 *
 * `defaultRoles` khớp Y HỆT mảng `roles` hiện có ở
 * frontend/app/(dashboard)/layout.tsx (ALL_NAV_ITEMS) tại thời điểm viết —
 * dùng làm quyền MẶC ĐỊNH khi Admin CHƯA cấu hình gì cho 1 (account,
 * module) cụ thể, đảm bảo không ai bị mất quyền đang có ngay sau khi triển
 * khai (xem module-permission.service.ts#getEffective).
 *
 * PHẠM VI CỐ Ý CHỪA LẠI (yêu cầu người dùng: "phiên bản đơn giản", không
 * làm quyền chi tiết từng hành động) — các controller sau KHÔNG nằm trong
 * registry này, tiếp tục hoạt động y hệt hiện tại, không bị Guard này chặn:
 * - AuthController, NotificationController, BirthdayController,
 *   ColumnWidthController.
 * - TeamsController: tự có @Roles() riêng ĐÚNG cho từng route (GET /team:
 *   admin/manager/leader/mkt; GET /team/:id/member: admin/manager/leader) —
 *   nhiều trang khác (Data lao động/Lịch hẹn/Chấm công/Báo cáo) gọi thẳng 2
 *   route này cho Leader/MKT xem tên nhóm/thành viên. Từng bị gộp nhầm vào
 *   module "accounts" (chỉ Admin), gây lỗi 403 sai cho Leader/MKT ở các
 *   trang trên (phát hiện 2026-07-27, test thật với tài khoản không phải
 *   Admin) — đã gỡ ra khỏi registry, chỉ còn AccountsController thật sự
 *   thuộc module "accounts". POST/PUT/DELETE /team vẫn @Roles('admin')
 *   riêng, không bị ảnh hưởng.
 * - CheckinController, LeaveRequestsController, LeaveAccrualController: có
 *   endpoint TỰ PHỤC VỤ (nhân viên tự check-in, tự tạo đơn nghỉ phép) lẫn
 *   endpoint quản trị trong CÙNG 1 controller — gate cả controller sẽ chặn
 *   nhầm cả phần tự phục vụ. Để tránh rủi ro khóa nhầm chức năng cốt lõi
 *   (chấm công tự động, xin nghỉ phép), KHÔNG gate 2 tab con này trong
 *   phiên bản đơn giản — chỉ gate đúng bảng "Chấm công thủ công" chính
 *   (AttendanceController). Có thể tách quyền riêng cho 2 tab này sau nếu
 *   cần độ chi tiết cao hơn.
 * - AnonymousFeedbackController (Đơn phản ánh ẩn danh, 2026-10-28): MỌI
 *   nhân viên được gửi, kể cả vai trò không vào được trang Chấm công — quyền
 *   gửi/xem kiểm tra theo vai trò trong AnonymousFeedbackService.
 * - CatalogController, StatusController, SaleReminderController: dữ liệu
 *   danh mục dùng CHUNG bởi nhiều module (dropdown trạng thái/nguồn...) —
 *   gate theo 1 module sẽ chặn nhầm module khác đang dùng chung danh mục.
 */
export interface ModuleRegistryEntry {
  code: string;
  label: string;
  /** Vai trò mặc định được SỬA module này. */
  defaultRoles: AccountRole[];
  /** Vai trò mặc định CHỈ XEM (không thêm/sửa/xoá) — Admin vẫn chỉnh riêng được từng người. */
  viewRoles?: AccountRole[];
  controllers: Type<unknown>[];
}

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  {
    code: 'dashboard',
    label: 'Trang chủ Dashboard',
    defaultRoles: ['admin', 'manager', 'leader', 'mkt', 'sale'],
    // CareProgressController: khối "Tiến độ chăm sóc" (Kho chăm sóc) trên
    // Dashboard — tab cùng tên trong Báo cáo gọi chung API này.
    controllers: [DashboardController, CareProgressController],
  },
  {
    code: 'candidates',
    label: 'Data lao động',
    defaultRoles: ['admin', 'manager', 'mkt', 'leader', 'sale'],
    controllers: [
      CandidatesController,
      ImportsController,
      InterviewCallbackController,
      CarePoolController,
      CareWarehouseController,
      DistributionRuleController,
    ],
  },
  {
    code: 'shuttle',
    label: 'Danh sách đưa đón',
    // Rà soát phân quyền 2026-10-30: chỉ Admin/Quản lý thêm/sửa/xoá (cả danh
    // mục tuỳ chọn); Leader/MKT/Sale chỉ xem mọi dòng.
    defaultRoles: ['admin', 'manager'],
    viewRoles: ['leader', 'mkt', 'sale'],
    controllers: [ShuttleController],
  },
  {
    code: 'reports',
    label: 'Báo cáo',
    defaultRoles: ['admin', 'manager', 'leader', 'sale'],
    controllers: [
      ReportController,
      DailyReportsController,
      ReportPenaltyController,
    ],
  },
  {
    code: 'attendance',
    label: 'Chấm công',
    defaultRoles: ['admin', 'manager', 'leader', 'mkt', 'sale'],
    controllers: [AttendanceController],
  },
  {
    code: 'sales-entry',
    label: 'Nhập doanh số',
    // Yêu cầu trực tiếp người dùng (2026-07-27): "Sale sẽ tự nhập doanh số
    // cho chính mình... leader, quản lý, admin là được chọn sale như hiện
    // tại". Mở rộng từ chỉ Admin sang cả 4 vai trò còn lại — phạm vi
    // xem/sửa/xóa CHI TIẾT theo từng vai trò (Sale: chỉ dòng của mình;
    // Leader: cả nhóm; Quản lý/Admin/Kế toán: toàn bộ) được enforce THẬT ở
    // sales-entry.service.ts (buildWhere/createRow/updateRow/deleteRows),
    // không chỉ dừng ở việc cho vào trang.
    defaultRoles: ['admin', 'manager', 'leader', 'sale', 'accounting'],
    controllers: [SalesEntryController],
  },
  {
    code: 'calendar',
    label: 'Lịch hẹn',
    defaultRoles: ['admin', 'manager', 'leader', 'sale'],
    controllers: [CalendarController],
  },
  {
    code: 'audit-log',
    label: 'Nhật ký',
    defaultRoles: ['admin', 'manager'],
    controllers: [AuditLogController],
  },
  {
    code: 'accounts',
    label: 'Quản lý tài khoản',
    defaultRoles: ['admin'],
    // Sửa lỗi (2026-07-27, phát hiện khi test thật với tài khoản Leader/MKT
    // — không phải Admin): TeamsController KHÔNG được liệt kê ở đây nữa.
    // TeamsController tự có @Roles() riêng biệt, ĐÚNG cho từng route
    // (GET /team: admin/manager/leader/mkt; GET /team/:id/member:
    // admin/manager/leader — các trang Data lao động/Lịch hẹn/Chấm
    // công/Báo cáo đều gọi thẳng 2 route này cho Leader/MKT xem tên
    // nhóm/thành viên). Gate cả TeamsController theo module "accounts"
    // (chỉ Admin) đã chặn NHẦM các vai trò mà chính @Roles() của nó đã cho
    // phép — sai với nguyên tắc "phân quyền module chỉ THÊM giới hạn,
    // không thay thế @Roles() hiện có" (xem module-permission.guard.ts).
    // POST/PUT/DELETE /team vẫn @Roles('admin') riêng, không bị ảnh hưởng.
    controllers: [AccountsController],
  },
  // "Kế toán" — CHỈ khung sườn, chưa có controller backend (trang tĩnh "sắp
  // ra mắt") — không có gì để Guard kiểm tra, nhưng vẫn liệt kê ở đây
  // (controllers: []) để hiện trong trang Admin "Phân quyền" và gate được
  // Ở TẦNG FRONTEND (ẩn menu/chặn route).
  {
    code: 'accounting',
    label: 'Kế toán',
    defaultRoles: ['admin'],
    controllers: [],
  },
  {
    code: 'order-management',
    label: 'Quản lý đơn hàng',
    defaultRoles: ['admin'],
    controllers: [OrderManagementController],
  },
];

export function findModuleByController(
  controllerClass: Type<unknown>,
): ModuleRegistryEntry | undefined {
  return MODULE_REGISTRY.find((entry) =>
    entry.controllers.includes(controllerClass),
  );
}

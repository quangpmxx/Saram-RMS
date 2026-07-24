import type { Type } from '@nestjs/common';
import { AccountRole } from '../../generated/prisma/enums';
import { DashboardController } from '../dashboard/dashboard.controller';
import { ReportController } from '../dashboard/report.controller';
import { CandidatesController } from '../candidates/candidates.controller';
import { ImportsController } from '../imports/imports.controller';
import { InterviewCallbackController } from '../candidates/interview-callback.controller';
import { CarePoolController } from '../care-pool/care-pool.controller';
import { DistributionRuleController } from '../distribution/distribution-rule.controller';
import { ShuttleController } from '../shuttle/shuttle.controller';
import { DailyReportsController } from '../daily-reports/daily-reports.controller';
import { ReportPenaltyController } from '../report-penalty/report-penalty.controller';
import { AttendanceController } from '../attendance/attendance.controller';
import { SalesEntryController } from '../sales-entry/sales-entry.controller';
import { CalendarController } from '../calendar/calendar.controller';
import { AuditLogController } from '../audit-log/audit-log.controller';
import { AccountsController } from '../accounts/accounts.controller';
import { TeamsController } from '../teams/teams.controller';
import { SystemConfigController } from '../system-config/system-config.controller';

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
 *   ColumnWidthController, PermissionController (hệ thống quyền CŨ, 5 hành
 *   động cụ thể ở trang Quản lý tài khoản — giữ nguyên, không đụng).
 * - CheckinController, LeaveRequestsController, LeaveAccrualController: có
 *   endpoint TỰ PHỤC VỤ (nhân viên tự check-in, tự tạo đơn nghỉ phép) lẫn
 *   endpoint quản trị trong CÙNG 1 controller — gate cả controller sẽ chặn
 *   nhầm cả phần tự phục vụ. Để tránh rủi ro khóa nhầm chức năng cốt lõi
 *   (chấm công tự động, xin nghỉ phép), KHÔNG gate 2 tab con này trong
 *   phiên bản đơn giản — chỉ gate đúng bảng "Chấm công thủ công" chính
 *   (AttendanceController). Có thể tách quyền riêng cho 2 tab này sau nếu
 *   cần độ chi tiết cao hơn.
 * - CatalogController, StatusController, SaleReminderController: dữ liệu
 *   danh mục dùng CHUNG bởi nhiều module (dropdown trạng thái/nguồn...) —
 *   gate theo 1 module sẽ chặn nhầm module khác đang dùng chung danh mục.
 */
export interface ModuleRegistryEntry {
  code: string;
  label: string;
  defaultRoles: AccountRole[];
  controllers: Type<unknown>[];
}

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  {
    code: 'dashboard',
    label: 'Trang chủ Dashboard',
    defaultRoles: ['admin', 'manager', 'leader', 'mkt', 'sale'],
    controllers: [DashboardController],
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
      DistributionRuleController,
    ],
  },
  {
    code: 'shuttle',
    label: 'Danh sách đưa đón',
    defaultRoles: ['admin', 'manager', 'leader', 'mkt', 'sale'],
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
    defaultRoles: ['admin'],
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
    controllers: [AccountsController, TeamsController],
  },
  {
    code: 'settings',
    label: 'Cấu hình vận hành',
    defaultRoles: ['admin'],
    controllers: [SystemConfigController],
  },
  // "Kế toán" và "Quản lý đơn hàng" — CHỈ khung sườn, chưa có controller
  // backend (trang tĩnh "sắp ra mắt") — không có gì để Guard kiểm tra,
  // nhưng vẫn liệt kê ở đây (controllers: []) để hiện trong trang Admin
  // "Phân quyền" và gate được Ở TẦNG FRONTEND (ẩn menu/chặn route).
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
    controllers: [],
  },
];

export function findModuleByController(
  controllerClass: Type<unknown>,
): ModuleRegistryEntry | undefined {
  return MODULE_REGISTRY.find((entry) =>
    entry.controllers.includes(controllerClass),
  );
}

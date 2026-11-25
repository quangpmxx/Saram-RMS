import type { AccountRole } from '../../../generated/prisma/enums';

/**
 * Phân quyền chi tiết (2026-11-07, yêu cầu người dùng): danh mục MỌI quyền
 * nhỏ trong hệ thống. Mỗi quyền có vai trò mặc định — khớp Y HỆT hành vi cũ
 * (viết cứng theo vai trò) để không ai mất/thêm quyền khi triển khai. Admin
 * chỉnh riêng từng người ở trang Phân quyền: Theo vai trò / Cho phép / Không
 * cho phép (bảng `user_capabilities`). Admin luôn có mọi quyền.
 *
 * File thuần (không import service) để mọi service gọi `can()` được mà không
 * dính vòng import. Frontend lấy danh mục qua GET /module-permission/capabilities.
 *
 * Luật cứng KHÔNG nằm ở đây (không mở bằng phân quyền): số đang giữ chỉ
 * người giữ thao tác; chỉ chia data cho Sale/Sup Leader (và Leader được bật
 * lead.claim — isLeadReceiver); Phân quyền, thêm/xoá nhân viên, reset mật
 * khẩu chỉ Admin. Quyền trái luật với vai trò: xem applicableRoles.
 */
export interface CapabilityEntry {
  code: string;
  /** Mã module (trang) chứa quyền — khớp module-registry. */
  module: string;
  label: string;
  /** Ghi chú ngắn hiện dưới tên quyền (tuỳ chọn). */
  hint?: string;
  defaultRoles: AccountRole[];
  /**
   * Vai trò dùng được quyền này (bỏ trống = mọi vai trò). Vai trò ngoài danh sách: trang Phân quyền
   * ẩn quyền, và chỉnh riêng cũ (nếu có) bị bỏ qua — vd quyền "toàn công ty" ở data lao động không
   * bao giờ áp cho người làm theo nhóm (nhóm nào chỉ biết data nhóm ấy). Rà soát 2026-11-20.
   */
  applicableRoles?: AccountRole[];
  /** Quyền cần có kèm để dùng được — trang Phân quyền tự bật kèm / tự tắt theo. */
  requires?: string[];
  /** Mặc định CÓ thêm cho vai trò `role` khi người đó có quyền `cap` (vd Leader nhận data thì giữ số được). */
  alsoDefaultWhen?: { role: AccountRole; cap: string };
  /** Việc chỉ dành cho nhân viên (nộp báo cáo, xin nghỉ...) — Admin cũng KHÔNG mặc nhiên có. */
  notForAdmin?: boolean;
}

/** Vai trò thuộc nhóm (data/khối lượng theo nhóm). */
const TEAM_ROLES: AccountRole[] = ['leader', 'sale', 'sup_leader'];
/** Vai trò không thuộc nhóm nào (đổi sang các vai trò này thì bị gỡ khỏi nhóm). */
const NON_TEAM_ROLES: AccountRole[] = [
  'manager',
  'mkt',
  'accounting',
  'order_staff',
  'shuttle_staff',
  'media_staff',
  'recruitment_staff',
];
/** Vai trò nhận/xử lý data như Sale. */
const SALE_LIKE_ROLES: AccountRole[] = ['sale', 'sup_leader'];

export const CAPABILITY_CATALOG: CapabilityEntry[] = [
  // ---------------------------------------------------------------- Data lao động
  {
    code: 'lead.create',
    module: 'candidates',
    label: 'Thêm data thủ công',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'lead.import',
    module: 'candidates',
    label: 'Import data từ Excel',
    defaultRoles: ['mkt'],
  },
  {
    code: 'lead.import_legacy',
    module: 'candidates',
    label: 'Up data cũ',
    defaultRoles: [],
  },
  {
    code: 'lead.pancake_auto_up',
    module: 'candidates',
    label: 'Cài đặt Up data tự động từ Pancake',
    defaultRoles: ['mkt'],
  },
  {
    code: 'lead.view_ad_campaign',
    module: 'candidates',
    label: 'Xem nhóm quảng cáo (ad set) của data',
    hint: 'Dòng Ad set ở trang Chi tiết (data up tự động từ Pancake)',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'lead.view_all',
    applicableRoles: NON_TEAM_ROLES,
    module: 'candidates',
    label: 'Xem data toàn công ty (mọi nhóm, kể cả danh sách trùng)',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'lead.view_team',
    applicableRoles: TEAM_ROLES,
    module: 'candidates',
    label: 'Xem data cả nhóm mình',
    hint: 'Không có quyền này và quyền trên thì chỉ thấy data mình phụ trách',
    defaultRoles: ['leader', 'sale', 'sup_leader'],
  },
  {
    code: 'lead.view_pending',
    module: 'candidates',
    label: 'Xem danh sách chờ phân chia',
    defaultRoles: ['manager', 'leader', 'mkt', 'sale', 'sup_leader'],
  },
  {
    code: 'lead.edit_all',
    module: 'candidates',
    label: 'Sửa thông tin mọi data',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'lead.process_all',
    module: 'candidates',
    label: 'Xử lý mọi data (ghi chú, trạng thái, Zalo, lịch PV, gọi lại)',
    defaultRoles: ['manager'],
  },
  {
    code: 'lead.edit_team',
    requires: ['lead.view_team'],
    applicableRoles: TEAM_ROLES,
    module: 'candidates',
    label: 'Sửa và xử lý mọi data trong nhóm mình',
    defaultRoles: ['leader'],
  },
  {
    code: 'lead.edit_help',
    applicableRoles: SALE_LIKE_ROLES,
    module: 'candidates',
    label: 'Xử lý hộ data trong nhóm đã có người phụ trách',
    hint: 'Sửa thông tin hộ khi data đã được xử lý ít nhất 1 lần',
    defaultRoles: ['sale', 'sup_leader'],
  },
  {
    code: 'lead.delete',
    module: 'candidates',
    label: 'Xoá data',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'lead.assign',
    requires: ['lead.view_pending'],
    module: 'candidates',
    label: 'Phân chia data chờ cho Sale',
    defaultRoles: ['manager', 'leader'],
  },
  {
    code: 'lead.transfer',
    module: 'candidates',
    label: 'Chuyển data sang Sale khác',
    defaultRoles: ['manager', 'leader'],
  },
  {
    code: 'lead.remind',
    module: 'candidates',
    label: 'Nhắc Sale gọi lại',
    defaultRoles: ['manager', 'leader'],
  },
  {
    code: 'lead.manage_all_teams',
    requires: ['lead.view_all'],
    applicableRoles: NON_TEAM_ROLES,
    module: 'candidates',
    label: 'Chia/chuyển/giao Kho/bỏ giữ số/sửa ghi chú với MỌI nhóm',
    hint: 'Không có thì các thao tác đó chỉ trong nhóm mình',
    defaultRoles: ['manager'],
  },
  {
    code: 'lead.claim',
    requires: ['lead.view_pending'],
    applicableRoles: [...SALE_LIKE_ROLES, 'leader'],
    module: 'candidates',
    label: 'Tự nhận data chờ phân chia',
    hint: 'Bật cho Leader thì Leader cũng được chia/chuyển data (không vào vòng chia tự động)',
    defaultRoles: ['sale', 'sup_leader'],
  },
  {
    code: 'lead.hold',
    alsoDefaultWhen: { role: 'leader', cap: 'lead.claim' },
    module: 'candidates',
    label: 'Giữ số',
    defaultRoles: ['manager', 'sale', 'sup_leader'],
  },
  {
    code: 'lead.unhold_others',
    module: 'candidates',
    label: 'Bỏ giữ số của người khác',
    defaultRoles: ['manager', 'leader'],
  },
  {
    code: 'note.manage_others',
    module: 'candidates',
    label: 'Sửa/xoá ghi chú của người khác',
    defaultRoles: ['manager', 'leader'],
  },
  {
    code: 'distribution.view_all',
    applicableRoles: NON_TEAM_ROLES,
    module: 'candidates',
    label: 'Xem cấu hình Chia tự động mọi nhóm',
    defaultRoles: ['manager'],
  },
  {
    code: 'distribution.config_team',
    applicableRoles: TEAM_ROLES,
    module: 'candidates',
    label: 'Cấu hình Chia tự động cho nhóm mình',
    defaultRoles: ['leader'],
  },
  {
    code: 'distribution.config_all',
    requires: ['distribution.view_all'],
    applicableRoles: NON_TEAM_ROLES,
    module: 'candidates',
    label: 'Cấu hình Chia tự động mọi nhóm',
    defaultRoles: [],
  },
  // ---------------------------------------------------------------- Kho chăm sóc
  {
    code: 'care.view_all',
    applicableRoles: NON_TEAM_ROLES,
    module: 'candidates',
    label: 'Kho chăm sóc: xem Kho mọi nhóm',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'care.assign',
    module: 'candidates',
    label: 'Kho chăm sóc: giao data (thủ công, ngẫu nhiên, thu hồi, giao lại)',
    defaultRoles: ['manager', 'leader'],
  },
  {
    code: 'care.claim',
    applicableRoles: SALE_LIKE_ROLES,
    module: 'candidates',
    label: 'Kho chăm sóc: tự nhận data',
    defaultRoles: ['sale', 'sup_leader'],
  },
  {
    code: 'care.stop',
    module: 'candidates',
    label: 'Kho chăm sóc: dừng/tiếp tục chăm sóc trực tiếp',
    defaultRoles: ['manager', 'leader'],
  },
  {
    code: 'care.stop_request',
    applicableRoles: SALE_LIKE_ROLES,
    module: 'candidates',
    label: 'Kho chăm sóc: gửi đề nghị dừng chăm sóc data mình nhận',
    defaultRoles: ['sale', 'sup_leader'],
  },
  {
    code: 'care.decide_stop',
    module: 'candidates',
    label: 'Kho chăm sóc: duyệt/từ chối đề nghị dừng chăm sóc',
    defaultRoles: ['manager', 'leader'],
  },
  {
    code: 'care.progress',
    module: 'candidates',
    label: 'Tiến độ chăm sóc: xem cả nhóm/từng nhân viên',
    hint: 'Không có thì chỉ xem của mình',
    defaultRoles: ['manager', 'leader', 'mkt'],
  },
  // ---------------------------------------------------------------- Dashboard
  {
    code: 'dashboard.filter_all',
    module: 'dashboard',
    label: 'Lọc số liệu theo mọi nhóm/nhân viên',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'dashboard.filter_team',
    applicableRoles: TEAM_ROLES,
    module: 'dashboard',
    label: 'Lọc số liệu theo nhóm mình/nhân viên trong nhóm',
    defaultRoles: ['leader'],
  },
  {
    code: 'dashboard.perf_all',
    module: 'dashboard',
    label: 'Xem hiệu quả từng nhân viên toàn công ty',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'dashboard.perf_team',
    applicableRoles: TEAM_ROLES,
    module: 'dashboard',
    label: 'Xem hiệu quả từng nhân viên trong nhóm',
    hint: 'Không có quyền này và quyền trên thì chỉ xem của mình',
    defaultRoles: ['leader'],
  },
  {
    code: 'dashboard.mkt_cost',
    module: 'dashboard',
    label: 'Xem khối Chi phí Marketing',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    // Trợ lý giọng nói (2026-11-25): nút micro trên đầu trang, đọc số Dashboard — số liệu vẫn theo quyền xem ở trên.
    code: 'voice.assistant',
    module: 'dashboard',
    label: 'Dùng Trợ lý giọng nói',
    hint: 'Hỏi số liệu bằng giọng nói, chỉ trả lời trong phạm vi được xem',
    defaultRoles: ['manager', 'leader', 'mkt', 'sale', 'sup_leader'],
  },
  // ---------------------------------------------------------------- Báo cáo
  {
    code: 'report.submit',
    applicableRoles: SALE_LIKE_ROLES,
    module: 'reports',
    label: 'Nộp báo cáo hằng ngày',
    defaultRoles: ['sale', 'sup_leader'],
    notForAdmin: true,
  },
  {
    code: 'report.view_team',
    applicableRoles: TEAM_ROLES,
    module: 'reports',
    label: 'Xem báo cáo hằng ngày cả nhóm',
    defaultRoles: ['leader'],
  },
  {
    code: 'report.view_all',
    module: 'reports',
    label: 'Xem báo cáo hằng ngày toàn công ty',
    defaultRoles: ['manager'],
  },
  {
    code: 'penalty.view_team',
    applicableRoles: TEAM_ROLES,
    module: 'reports',
    label: 'Xem phạt báo cáo cả nhóm',
    defaultRoles: ['leader'],
  },
  {
    code: 'penalty.view_all',
    module: 'reports',
    label: 'Xem phạt báo cáo toàn công ty',
    defaultRoles: ['manager'],
  },
  {
    code: 'penalty.manage',
    requires: ['penalty.view_all'],
    module: 'reports',
    label: 'Quản lý phạt báo cáo (miễn phạt, cấu hình)',
    defaultRoles: ['manager'],
  },
  // ---------------------------------------------------------------- Chấm công
  {
    code: 'attendance.edit',
    module: 'attendance',
    label: 'Sửa bảng chấm công',
    defaultRoles: ['manager'],
  },
  {
    code: 'attendance.view_team',
    applicableRoles: TEAM_ROLES,
    module: 'attendance',
    label: 'Xem chấm công cả nhóm',
    // 2026-11-23 (user): Leader chỉ xem công của mình như Sale — không thấy
    // công hằng ngày, chỉ thấy bảng công tháng khi đã được gửi. Vẫn bật riêng được ở Phân quyền.
    defaultRoles: [],
  },
  {
    code: 'attendance.view_all',
    module: 'attendance',
    label: 'Xem chấm công toàn công ty',
    defaultRoles: ['manager'],
  },
  {
    code: 'checkin.manage',
    module: 'attendance',
    label: 'Cấu hình check-in và xem chi tiết check-in',
    defaultRoles: ['manager'],
  },
  {
    code: 'leave.create',
    module: 'attendance',
    label: 'Tạo đơn nghỉ phép',
    defaultRoles: ['mkt', 'sale', 'sup_leader', 'leader'],
    notForAdmin: true,
  },
  {
    code: 'leave.approve_team',
    applicableRoles: TEAM_ROLES,
    module: 'attendance',
    label: 'Duyệt nghỉ phép cấp 1 (trong nhóm)',
    defaultRoles: ['leader'],
    notForAdmin: true,
  },
  {
    code: 'leave.approve_final',
    module: 'attendance',
    label: 'Duyệt nghỉ phép cấp 2 (toàn công ty)',
    defaultRoles: ['manager'],
  },
  {
    code: 'leave.delete',
    module: 'attendance',
    label: 'Xoá đơn nghỉ phép',
    defaultRoles: [],
  },
  {
    code: 'feedback.view',
    module: 'attendance',
    label: 'Xem đơn phản ánh ẩn danh',
    defaultRoles: ['manager'],
  },
  // ---------------------------------------------------------------- Danh sách đưa đón
  {
    code: 'shuttle.sheet_sync',
    module: 'shuttle',
    label: 'Đồng bộ danh sách từ Google Sheet',
    hint: 'Cần thêm mức Sửa ở trang Danh sách đưa đón',
    // Như lúc ra mắt (2026-11-10): ai sửa được Đưa đón đều bấm được.
    defaultRoles: [
      'manager',
      'leader',
      'mkt',
      'sale',
      'sup_leader',
      'accounting',
      'order_staff',
      'shuttle_staff',
    ],
  },
  {
    code: 'shuttle.sheet_config',
    module: 'shuttle',
    label: 'Cài đặt đồng bộ Google Sheet (link sheet, chìa khoá robot)',
    defaultRoles: [],
  },
  {
    code: 'shuttle.import',
    module: 'shuttle',
    label: 'Nhập Excel danh sách đưa đón cũ',
    defaultRoles: [],
  },
  // ---------------------------------------------------------------- Nhập doanh số
  {
    code: 'sales.team',
    applicableRoles: TEAM_ROLES,
    module: 'sales-entry',
    label: 'Nhập/xem doanh số cả nhóm',
    defaultRoles: ['leader'],
  },
  {
    code: 'sales.all',
    module: 'sales-entry',
    label: 'Nhập/xem doanh số toàn công ty',
    hint: 'Không có quyền này và quyền trên thì chỉ doanh số của mình',
    defaultRoles: ['manager', 'accounting'],
  },
  // ---------------------------------------------------------------- Lịch hẹn
  {
    code: 'calendar.view_team',
    applicableRoles: TEAM_ROLES,
    module: 'calendar',
    label: 'Xem lịch hẹn cả nhóm',
    defaultRoles: ['leader'],
  },
  {
    code: 'calendar.view_all',
    applicableRoles: NON_TEAM_ROLES,
    module: 'calendar',
    label: 'Xem lịch hẹn toàn công ty',
    defaultRoles: ['manager', 'mkt'],
  },
  // ---------------------------------------------------------------- Marketing Hub
  {
    code: 'mkt.link_own',
    module: 'marketing-hub',
    label: 'Liên kết/đồng bộ/gỡ TKQC và page Pancake của mình',
    defaultRoles: ['mkt'],
  },
  {
    code: 'mkt.assign_owner',
    module: 'marketing-hub',
    label:
      'Gán/đổi người phụ trách TKQC, page (và thao tác TKQC của người khác)',
    defaultRoles: [],
  },
  {
    code: 'mkt.config',
    module: 'marketing-hub',
    label: 'Gắn Nguồn MKT, đặt mốc giá số, quản lý danh mục Nguồn MKT',
    defaultRoles: [],
  },
  {
    code: 'mkt.toggle_adset',
    module: 'marketing-hub',
    label: 'Bật/tắt nhóm quảng cáo (ad set) từ phần mềm',
    hint: 'Chỉ TKQC mình phụ trách (có quyền Gán/đổi người phụ trách thì mọi TKQC); token TKQC cần quyền ads_management',
    defaultRoles: ['mkt'],
  },
  // ---------------------------------------------------------------- Khác
  {
    code: 'notification.send',
    module: 'other',
    label: 'Gửi thông báo cho nhân viên',
    defaultRoles: ['manager'],
  },
  {
    code: 'team.manage',
    module: 'other',
    label: 'Thêm/sửa/xoá nhóm',
    defaultRoles: [],
  },
  // ---------------------------------------------------------------- Media (2026-11-14)
  // Trưởng phòng MKT ≈ vai trò MKT/Quản lý (mặc định có cả 5 quyền). Trưởng nhóm
  // Media = tài khoản NV Media được Admin bật thêm "Giao việc" + "Duyệt sản phẩm".
  {
    code: 'media.manage_plan',
    module: 'media',
    label: 'Quản lý kế hoạch, chiến dịch, nhóm nội dung & kênh đăng',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'media.assign',
    module: 'media',
    label: 'Tạo / giao việc, xem mọi công việc Media',
    hint: 'Không có quyền này thì chỉ thấy việc mình phụ trách / tham gia',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'media.review',
    module: 'media',
    label: 'Duyệt sản phẩm (duyệt / yêu cầu chỉnh sửa)',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'media.manage_publish',
    module: 'media',
    label: 'Sửa mọi lịch xuất bản & số liệu hiệu quả',
    hint: 'Không có quyền này thì chỉ sửa bài mình đăng / mình tạo',
    defaultRoles: ['manager', 'mkt'],
  },
  {
    code: 'media.view_report',
    module: 'media',
    label: 'Xem báo cáo hiệu quả & thống kê toàn bộ nhân viên',
    defaultRoles: ['manager', 'mkt'],
  },
];

export const CAPABILITY_CODES = new Set(CAPABILITY_CATALOG.map((c) => c.code));
const BY_CODE = new Map(CAPABILITY_CATALOG.map((c) => [c.code, c]));

/** Người dùng tối thiểu để kiểm quyền — khớp AuthenticatedUser. */
export interface CapabilityUser {
  role: AccountRole;
  /** Quyền chỉnh riêng (true = cho phép, false = không cho phép); nạp ở JwtStrategy. */
  capabilityOverrides?: Record<string, boolean>;
}

export function defaultCapability(role: AccountRole, code: string): boolean {
  const entry = BY_CODE.get(code);
  if (!entry) return false;
  if (role === 'admin') return !entry.notForAdmin;
  return entry.defaultRoles.includes(role);
}

/** Vai trò này dùng được quyền `code` không (Admin luôn được). */
export function isCapabilityApplicable(
  role: AccountRole,
  code: string,
): boolean {
  if (role === 'admin') return true;
  const roles = BY_CODE.get(code)?.applicableRoles;
  return !roles || roles.includes(role);
}

/** Người dùng có quyền `code` không — Admin luôn có (trừ việc chỉ dành cho nhân viên). Mã sai → false. */
export function can(user: CapabilityUser, code: string): boolean {
  if (user.role === 'admin') return defaultCapability('admin', code);
  const entry = BY_CODE.get(code);
  if (!entry) return false;
  if (!isCapabilityApplicable(user.role, code)) return false;
  const override = user.capabilityOverrides?.[code];
  if (override !== undefined) return override;
  if (defaultCapability(user.role, code)) return true;
  const extra = entry.alsoDefaultWhen;
  return Boolean(extra && extra.role === user.role && can(user, extra.cap));
}

/** Danh sách mã quyền hiệu lực — trả về frontend (GET /me). */
export function effectiveCapabilities(user: CapabilityUser): string[] {
  return CAPABILITY_CATALOG.filter((c) => can(user, c.code)).map((c) => c.code);
}

/** Quyền "toàn công ty" ở bất kỳ trang nào — dùng để mở danh sách nhóm. */
const ALL_TEAMS_CAPS = [
  'lead.view_all',
  'lead.manage_all_teams',
  'care.view_all',
  'dashboard.filter_all',
  'dashboard.perf_all',
  'report.view_all',
  'penalty.view_all',
  'attendance.view_all',
  'sales.all',
  'calendar.view_all',
  'distribution.view_all',
  'distribution.config_all',
];

/**
 * Xem tên MỌI nhóm (GET /team): Admin/Quản lý/MKT như cũ, hoặc người có ít
 * nhất 1 quyền toàn công ty. Ngược lại chỉ nhóm mình.
 */
export function canSeeAllTeams(user: CapabilityUser): boolean {
  if (['admin', 'manager', 'mkt'].includes(user.role)) return true;
  return ALL_TEAMS_CAPS.some((code) => can(user, code));
}

/**
 * Xem thành viên nhóm khác (GET /team/:id/member): Admin/Quản lý như cũ, hoặc
 * người có quyền lọc/xem theo nhân viên toàn công ty.
 */
export function canSeeAllMembers(user: CapabilityUser): boolean {
  if (user.role === 'admin' || user.role === 'manager') return true;
  return ALL_TEAMS_CAPS.some((code) => can(user, code));
}

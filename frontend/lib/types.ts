// Kiểu dữ liệu khớp với "Đối tượng dữ liệu dùng chung" — Mục 0.1, docs/13-api-design.md.

// Yêu cầu trực tiếp người dùng (2026-07-16): thêm 3 vai trò mới — accounting
// (Kế toán), order_staff (NV QL Đơn hàng), shuttle_staff (NV Đưa đón). CHƯA
// gắn quyền truy cập trang/tính năng nào cho 3 vai trò này (không thêm vào
// bất kỳ mảng roles nào ở ALL_NAV_ITEMS layout.tsx, VIEW_ROLES backend...) —
// người dùng sẽ thống kê và thành lập bộ quyền cụ thể sau.
export type AccountRole =
  | "admin"
  | "manager"
  | "leader"
  | "mkt"
  | "sale"
  | "accounting"
  | "order_staff"
  | "shuttle_staff";
export type AccountStatus = "active" | "inactive";

export const ACCOUNT_ROLE_LABEL: Record<AccountRole, string> = {
  admin: "Admin",
  manager: "Manager",
  leader: "Leader",
  mkt: "NV MKT",
  sale: "NV Sale",
  accounting: "Kế toán",
  order_staff: "NV QL Đơn hàng",
  shuttle_staff: "NV Đưa đón",
};

export interface Account {
  id: string;
  full_name: string;
  username: string;
  role: AccountRole;
  team_id: string | null;
  team_name: string | null;
  status: AccountStatus;
  /** Dự án phụ — nâng cấp toàn diện: đường dẫn tương đối ảnh đại diện tự upload, null nếu chưa có. */
  avatar_url: string | null;
  /** Dự án phụ — nâng cấp toàn diện (2026-07-15, module Check in GPS): chức vụ tùy chỉnh — null = chưa đặt, dùng nhãn vai trò mặc định (ACCOUNT_ROLE_LABEL). */
  position: string | null;
  /**
   * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
   * docs/09-13, yêu cầu trực tiếp người dùng): 5 field hồ sơ nhân sự — CHỈ
   * Admin sửa được (trang Quản lý tài khoản), Nhân viên/Leader chỉ xem
   * (trang Cài đặt tài khoản). "YYYY-MM-DD" cho 2 field ngày.
   */
  date_of_birth: string | null;
  hire_date: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  remaining_leave_days: number | null;
  /** Bổ sung 2026-07-15 (yêu cầu trực tiếp người dùng): CCCD + STK — cùng quy tắc CHỈ Admin sửa/Nhân viên chỉ xem như 4 field phía trên. */
  citizen_id: string | null;
  bank_account_number: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): "Giao diện chúc mừng sinh nhật
 * nhân viên" — Mục 6: KHÔNG có ngày sinh/năm sinh/tuổi trong payload này,
 * chỉ tên/avatar/nhóm/chức vụ. Khớp BirthdayEmployeeDto/BirthdayTodayResponseDto
 * ở backend (birthday/dto/birthday-response.dto.ts).
 */
export interface BirthdayEmployee {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  role: AccountRole;
  position: string | null;
  team_name: string | null;
}

export interface BirthdayToday {
  /** "MM-DD" đang dùng để so khớp — ngày thật, hoặc ngày giả lập nếu đang xem thử (Mục 11). */
  date: string;
  is_preview: boolean;
  employees: BirthdayEmployee[];
}

export interface Team {
  id: string;
  name: string;
  leader_id: string | null;
  leader_name: string | null;
  member_count: number;
  created_at: string;
}

export interface PaginatedResult<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface ApiErrorBody {
  error_code: string;
  message: string;
}

// ── Phase 1 — Thu thập dữ liệu ứng viên ─────────────────────────────────

export interface LeadSource {
  id: string;
  name: string;
}

interface NamedRef {
  id: string;
  name: string;
}

/**
 * Dự án phụ — nâng cấp toàn diện: dùng cho MỌI tài khoản thực hiện hành động
 * (uploaded_by/assigned_to/held_by/care_pool_locked_by trên Candidate,
 * created_by trên Note/Interview/Callback) — yêu cầu trực tiếp người dùng:
 * "vai trò admin/quản lý/leader thì thao tác ở đâu cũng phải mở ngoặc vai
 * trò cạnh tên".
 */
export interface NamedRefWithRole extends NamedRef {
  role: AccountRole;
  avatar_url: string | null;
}

/** Đối tượng "Candidate" — Mục 0.1, docs/13-api-design.md. */
export interface Candidate {
  id: string;
  full_name: string;
  phone_number: string;
  birth_year: number | null;
  address: string | null;
  source: NamedRef;
  mkt_note: string | null;
  data_quality_score: number | null;
  uploaded_by: NamedRefWithRole;
  uploaded_at: string;
  assigned_to: NamedRefWithRole | null;
  assigned_team_id: string | null;
  assigned_at: string | null;
  assignment_method: string | null;
  call_status: NamedRef | null;
  call_result: NamedRef | null;
  zalo_status: NamedRef | null;
  zalo_friend_status: NamedRef | null;
  note_color: "yellow" | "green" | "red" | null;
  current_interview_status: NamedRef | null;
  current_employment_status: NamedRef | null;
  current_partner_company_name: string | null;
  is_held: boolean;
  held_by: NamedRefWithRole | null;
  held_at: string | null;
  last_activity_at: string | null;
  entered_care_pool_at: string | null;
  care_pool_locked_by: NamedRefWithRole | null;
  is_duplicate_flagged: boolean;
  created_at: string;
  updated_at: string;
}

export interface DuplicateWarningEntry {
  lead_id: string;
  uploaded_at: string;
  uploaded_by: string;
}

export interface DuplicateWarning {
  phone_number: string;
  matches: DuplicateWarningEntry[];
}

export interface CreateCandidateResult {
  candidate: Candidate;
  duplicate_warning: DuplicateWarning | null;
}

/** GET /candidate/:id/duplicates — tooltip chi tiết badge "Trùng SĐT". */
export interface DuplicateDetailMatch {
  lead_id: string;
  full_name: string;
  uploaded_at: string;
  assigned_to: NamedRef | null;
  team_name: string | null;
  status_label: string;
}

export interface DuplicateDetail {
  phone_number: string;
  visible: boolean;
  matches: DuplicateDetailMatch[];
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportJobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_rows: number | null;
  success_count: number;
  error_count: number;
  duplicate_count: number;
  errors: ImportRowError[];
  created_at: string;
  updated_at: string;
}

// ── Phase 2 — Phân chia thủ công & Không gian Sale/Leader ───────────────

/** Mục 3, docs/13-api-design.md — GET /team/:id/member. */
export interface TeamMember extends Account {
  assigned_count: number;
  care_pool_count: number;
}

export interface AssignBulkResult {
  assigned_count: number;
}

/** Yêu cầu trực tiếp người dùng (2026-07-16) — GET /candidate/:id/remind-target (danh sách chọn khi "Nhắc gọi lại"). */
export interface RemindTarget {
  id: string;
  full_name: string;
  role: AccountRole;
  avatar_url: string | null;
}

// ── Phase 3 — Pipeline cuộc gọi & Lịch sử ghi chú ────────────────────────

export type StatusCategory =
  | "call_status"
  | "call_result"
  | "interview_status"
  | "employment_status"
  | "zalo_status"
  | "zalo_friend_status";

/** GET /status — Mục 9, docs/13-api-design.md. */
export interface StatusCatalogItem {
  id: string;
  category: StatusCategory;
  code: string;
  name: string;
  sort_order: number;
}

/** Đối tượng "Note" — Mục 0.1, docs/13-api-design.md. */
export interface Note {
  id: string;
  lead_id: string;
  created_by: NamedRefWithRole;
  content: string;
  call_status: NamedRef | null;
  call_result: NamedRef | null;
  zalo_friend_status: NamedRef | null;
  created_at: string;
  is_deleted: boolean;
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — "Sửa chức năng cập nhật dữ
 * liệu realtime trong module Data lao động": payload WebSocket sự kiện
 * `leads:update`, khớp đúng LeadRealtimeEvent ở backend
 * (realtime-event.interface.ts).
 */
export type LeadChangeType =
  | "created"
  | "updated"
  | "deleted"
  | "assigned"
  | "transferred"
  | "held"
  | "unheld"
  | "note_created"
  | "note_updated"
  | "note_deleted"
  | "care_pool_locked"
  | "care_pool_released"
  | "care_pool_removed"
  | "care_pool_entered";

export interface LeadRealtimeEvent {
  lead_id: string;
  change_type: LeadChangeType;
  candidate?: Candidate;
  note?: Note;
  updated_at: string;
  actor: { id: string; role: AccountRole } | null;
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — "Mở rộng cơ chế đồng bộ
 * realtime sang Đưa đón/Báo cáo/Check phạt/Thông báo/Dashboard": contract
 * TỔNG QUÁT dùng chung cho 4 module này, khớp đúng backend
 * app-event.interface.ts — KHÁC hẳn LeadRealtimeEvent ở trên (module Data
 * lao động giữ nguyên, không đụng), phát trên kênh Socket.IO riêng
 * (`app:event`, xem lib/realtime.ts).
 */
export type AppRealtimeModule =
  | "transportation"
  | "daily-report"
  | "penalty"
  | "notification"
  | "dashboard"
  | "sales-entry";
export type AppRealtimeAction = "created" | "updated" | "deleted" | "invalidate";

export interface AppRealtimeEvent<TPayload = unknown> {
  module: AppRealtimeModule;
  entity: string;
  action: AppRealtimeAction;
  entity_id: string | null;
  updated_at: string;
  actor: { id: string; role: AccountRole } | null;
  payload?: TPayload;
}

// ── Phase 4 — Lịch phỏng vấn, lịch gọi lại & Calendar ────────────────────

/** Đối tượng "Interview" — Mục 0.1, docs/13-api-design.md. */
export interface Interview {
  id: string;
  lead_id: string;
  attempt_no: number;
  partner_company_name: string;
  scheduled_at: string;
  status: NamedRef;
  employment_status: NamedRef | null;
  employment_reason: string | null;
  created_by: NamedRefWithRole;
  created_at: string;
}

/** Đối tượng "Callback" — Mục 0.1, docs/13-api-design.md. */
export interface Callback {
  id: string;
  lead_id: string;
  scheduled_at: string;
  is_completed: boolean;
  created_by: NamedRefWithRole;
  created_at: string;
}

/** GET /calendar — Mục 7, docs/13-api-design.md. */
export interface CalendarEvent {
  type: "interview" | "callback";
  id: string;
  scheduled_at: string;
  candidate: { id: string; full_name: string; phone_number: string };
  /** Dự án phụ — nâng cấp toàn diện: Sale nào đặt lịch hẹn này — yêu cầu trực tiếp người dùng (2026-07-14). */
  created_by: NamedRefWithRole;
}

// ── Phase 5 — Cột chăm sóc tự động (Care Pool) ───────────────────────────

/** GET/PUT /config — Mục 9, docs/13-api-design.md. */
export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  updated_by: NamedRef;
  updated_at: string;
}

// ── Phase 6 — Tự động phân chia lead (Round-robin) ───────────────────────

/** GET/PUT /distribution-rule/:teamId — Mục 0.1, docs/13-api-design.md. */
export interface DistributionRule {
  id: string | null;
  team_id: string;
  is_active: boolean;
  last_assigned_position: number;
  members: Array<{ account_id: string; name: string; order_index: number }>;
}

// ── Phase 7 — Dashboard & Báo cáo ────────────────────────────────────────

/** Mục 9, docs/09 — 1 bước trong phễu chuyển đổi Lead → ... → Đi làm. */
export interface FunnelStep {
  code: "LEAD" | "INTERVIEW_SCHEDULED" | "ATTENDED" | "PASSED" | "EMPLOYED";
  label: string;
  count: number;
  percentage: number;
}

/**
 * Dự án phụ — nâng cấp toàn diện (riêng giao diện Dashboard, ngoài phạm vi
 * Design Freeze docs/09-13): 7 chỉ số đầy đủ + tỷ lệ, xem chi tiết công thức
 * tại backend/src/dashboard/dto/dashboard-response.dto.ts. Hẹn/Đến/Bùng/Đỗ/
 * Trượt PV (2026-07-14) lấy từ module Đưa đón. employed/employed_rate/
 * performance_rate = null (chưa có nguồn dữ liệu — chờ module Quản lý lao
 * động mới cung cấp API).
 */
export interface KpiBreakdown {
  new_leads: number;
  interview_scheduled: number;
  attended: number;
  no_show: number;
  passed: number;
  failed: number;
  employed: number | null;
  schedule_rate: number;
  attend_rate: number;
  pass_rate: number;
  employed_rate: number | null;
  performance_rate: number | null;
}

/** GET /dashboard/summary — Mục 8, docs/13-api-design.md. */
export interface DashboardSummary {
  new_leads_total: number;
  new_leads_by_source: Array<{ source_id: string; source_name: string; count: number }>;
  pending_count: number;
  funnel: FunnelStep[];
  care_pool_count: number;
  kpi: KpiBreakdown;
  kpi_previous: KpiBreakdown | null;
}

/** GET /dashboard/performance — Mục 8, docs/13-api-design.md. */
export interface SalePerformance {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  team_id: string | null;
  calls: number;
  potential_leads: number;
  interview_count: number;
  employed_count: number;
  kpi: KpiBreakdown;
}

/** GET /dashboard/by-team — Mục 8, docs/13-api-design.md. */
export interface TeamSummary {
  team_id: string;
  team_name: string;
  lead_count: number;
  conversion_rate: number;
  care_pool_count: number;
  kpi: KpiBreakdown;
}

/** GET /report/by-source — Mục 8, docs/13-api-design.md. */
export interface BySourceReport {
  source_id: string;
  source_name: string;
  lead_count: number;
  potential_rate: number;
  employed_rate: number;
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới): Báo cáo hằng ngày — thay thế nội dung trang
 * "Báo cáo" cũ (FunnelStep/BySourceReport ở trên GIỮ NGUYÊN, vẫn dùng cho
 * Dashboard).
 */
export interface DailyReportRow {
  date: string;
  account: { id: string; name: string; avatar_url: string | null; role: AccountRole };
  team: { id: string; name: string } | null;
  report_id: string | null;
  calls: number;
  old_data: number;
  no_answer: number;
  interested: number;
  interview_scheduled: number;
  interview_passed: number;
  employed: number;
  /** Luôn tính trực tiếp từ Data lao động (ngày lên số) — không nhập tay được. */
  new_leads: number;
  status: "reported" | "not_reported";
  created_at: string | null;
  updated_at: string | null;
  created_by: NamedRefWithRole | null;
  updated_by: NamedRefWithRole | null;
}

export interface DailyReportTotals {
  calls: number;
  old_data: number;
  no_answer: number;
  interested: number;
  interview_scheduled: number;
  interview_passed: number;
  employed: number;
  new_leads: number;
}

export interface DailyReportTeamSummary extends DailyReportTotals {
  team_id: string;
  team_name: string;
  reported_count: number;
  not_reported_count: number;
}

export interface DailyReportSummary {
  totals: DailyReportTotals;
  by_team: DailyReportTeamSummary[];
}

/** Body của POST/PUT /daily-report — 7 trường nhập tay, "Data mới" không có ở đây (không cho nhập tay). */
export interface UpsertDailyReportPayload {
  calls: number;
  old_data: number;
  no_answer: number;
  interested: number;
  interview_scheduled: number;
  interview_passed: number;
  employed: number;
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check phạt" — trang con
 * trong module Báo cáo, tự động ghi nhận Sale nộp Báo cáo hằng ngày
 * muộn/không nộp.
 */
export type ReportViolationType = "late_submission" | "no_submission";
export type ReportViolationStatus = "pending" | "confirmed" | "waived" | "supplemented";

export interface ReportViolation {
  id: string;
  account_id: string;
  account_name: string;
  account_avatar_url: string | null;
  team_id: string | null;
  team_name: string | null;
  /** "YYYY-MM-DD" */
  report_date: string;
  /** ISO — snapshot hạn chót tại thời điểm phát sinh vi phạm, không đổi dù Admin sửa cấu hình sau. */
  deadline_snapshot: string;
  actual_submitted_at: string | null;
  violation_type: ReportViolationType;
  status: ReportViolationStatus;
  note: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportDeadline {
  hour: number;
  minute: number;
  updated_at: string | null;
  updated_by_name: string | null;
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module hoàn toàn mới): "Chấm công thủ công". Không có field
 * "vị trí/chức vụ" riêng — cột "Vị trí" hiện bằng ACCOUNT_ROLE_LABEL[role]
 * giống mọi trang khác, không phát minh field mới.
 */
export type AttendanceStatus = "present" | "half" | "paid_leave" | "unpaid_leave" | "holiday" | "compensatory_leave";

export interface AttendanceEmployee {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  role: AccountRole;
  /** Chức vụ tùy chỉnh, sửa tay được — null = chưa đặt, cột "Vị trí" hiện nhãn vai trò mặc định (ACCOUNT_ROLE_LABEL[role]). */
  position: string | null;
  team_id: string | null;
  team_name: string | null;
  status: AccountStatus;
  /**
   * 5 field hồ sơ nhân sự (2026-07-15, yêu cầu trực tiếp người dùng) — chỉ
   * đọc ở modal "Thông tin nhân viên", sửa qua trang Quản lý tài khoản.
   */
  date_of_birth: string | null;
  hire_date: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  remaining_leave_days: number | null;
  /** Bổ sung 2026-07-15 (yêu cầu trực tiếp người dùng): CCCD + STK. */
  citizen_id: string | null;
  bank_account_number: string | null;
}

export interface AttendanceDay {
  /** "YYYY-MM-DD" */
  date: string;
  day: number;
  /** "CN"/"T2".."T7" */
  weekday_label: string;
  is_sunday: boolean;
}

export interface AttendanceCell {
  account_id: string;
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  note: string | null;
  updated_at: string;
}

export interface AttendanceGrid {
  year: number;
  month: number;
  days: AttendanceDay[];
  employees: AttendanceEmployee[];
  records: AttendanceCell[];
  can_edit: boolean;
}

export interface AttendanceUpsertCell {
  account_id: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 1+2+3
 * (triển khai theo 4 Phase, yêu cầu trực tiếp người dùng). Reset (Phase 4)
 * sẽ bổ sung vào ĐÚNG interface này.
 */
export type CheckinRecordStatus = "valid" | "outside_company" | "needs_verification";

/**
 * Field GPS/IP/thiết bị khai báo `| null` — bản ghi TỰ Check in luôn có giá
 * trị thật, nhưng danh sách quản lý (CheckinListEmployee) sẽ trả null khi
 * Leader xem bản ghi của NGƯỜI KHÁC (Mục 10: chỉ Admin/Quản lý xem chi tiết
 * GPS/IP/thiết bị của người khác — xem checkin.service.ts, redactRecordResponse()).
 */
export interface CheckinRecord {
  id: string;
  account_id: string;
  /** "YYYY-MM-DD" */
  attendance_date: string;
  /** ISO — lấy từ đồng hồ server. */
  checked_in_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  resolved_address: string | null;
  company_latitude: number | null;
  company_longitude: number | null;
  allowed_radius_meters: number;
  distance_from_company_meters: number;
  status: CheckinRecordStatus;
  ip_address: string | null;
  user_agent: string | null;
  device: string | null;
  operating_system: string | null;
  browser: string | null;
  /** Yêu cầu trực tiếp người dùng (2026-07-16): cột "Ghi chú" ở trang quản lý Check in GPS. */
  note: string | null;
  created_at: string;
}

export interface CheckinStatus {
  checked_in_today: boolean;
  today_record: CheckinRecord | null;
  /** ISO — giờ server hiện tại, dùng để đồng bộ đồng hồ hiển thị (không tin giờ thiết bị). */
  server_time: string;
  company_location_configured: boolean;
  /** Preview IP/thiết bị/trình duyệt SẼ được lưu nếu Check in ngay bây giờ. */
  ip_address: string | null;
  device: string;
  operating_system: string;
  browser: string;
}

export interface CheckinPreview {
  company_location_configured: boolean;
  distance_from_company_meters: number | null;
  status: CheckinRecordStatus | null;
  location_label: string | null;
}

/** Mục 11: 1 dòng trong "trang quản lý Check in" — 1 nhân viên + bản ghi Check in của họ (null nếu chưa Check in ngày đang xem). */
export interface CheckinListEmployee {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  role: AccountRole;
  position: string | null;
  team_id: string | null;
  team_name: string | null;
  checkin: CheckinRecord | null;
}

export interface CheckinListResult {
  /** "YYYY-MM-DD" */
  date: string;
  employees: CheckinListEmployee[];
}

export type CheckinStatusFilter = "all" | "checked_in" | "not_checked_in" | CheckinRecordStatus;

export interface CompanyLocation {
  address: string;
  latitude: number;
  longitude: number;
  allowed_radius_meters: number;
  updated_at: string;
  updated_by_name: string;
}

export interface AttendanceDeleteCell {
  account_id: string;
  date: string;
}

export interface AttendanceBulkSavePayload {
  upserts: AttendanceUpsertCell[];
  deletes: AttendanceDeleteCell[];
}

// ── Phase 9 — Nhật ký, Trùng lặp nâng cao & Phân quyền chi tiết ──────────

/** GET /candidate/duplicate — Mục 2, docs/13-api-design.md. */
export interface DuplicateGroup {
  phone_number: string;
  matches: Candidate[];
}

/** Đối tượng "AuditLog" — Mục 0.1, docs/13-api-design.md. */
export interface AuditLogEntry {
  id: string;
  account: NamedRef;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

/** Đối tượng "Permission" — Mục 0.1, docs/13-api-design.md. */
export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

/** PUT /account/:id/permission response — Mục 2, docs/13-api-design.md. */
export interface AccountPermissionGrant extends Permission {
  is_granted: boolean;
}

// ── Phase 8 — Thông báo Zalo ──────────────────────────────────────────

/** Đối tượng "Notification" — Mục 0.1, docs/13-api-design.md. GET /notification. */
export interface AppNotification {
  id: string;
  account_id: string;
  lead_id: string | null;
  /** Dự án phụ — nâng cấp toàn diện (2026-07-16, module "Tạo đơn"): gắn với 1 Đơn xin nghỉ phép cụ thể — khớp vai trò lead_id. */
  leave_request_id: string | null;
  type:
    | "callback_reminder"
    | "interview_reminder"
    | "admin_message"
    | "new_data_uploaded"
    | "manual_callback_reminder"
    | "leave_request_pending_leader"
    | "leave_request_pending_admin"
    | "leave_request_decided";
  channel: string;
  /** Dự án phụ — nâng cấp toàn diện: nội dung tự soạn khi type=admin_message, null với 2 loại nhắc lịch cũ. */
  content: string | null;
  /** Dự án phụ — nâng cấp toàn diện: người gửi khi type=admin_message, null với 2 loại nhắc lịch cũ (hệ thống tự tạo). */
  sender: { id: string; name: string; role: AccountRole; avatar_url: string | null } | null;
  scheduled_at: string;
  sent_at: string | null;
  status: "pending" | "sent" | "failed";
}

// ── Dự án phụ — nâng cấp toàn diện: Tạo đơn — Đơn xin nghỉ phép ─────────

export interface LeaveRequestPerson {
  id: string;
  full_name: string;
  role: AccountRole;
  avatar_url: string | null;
}

export type LeaveRequestStatus = "pending_leader" | "pending_admin" | "approved" | "rejected";
export type LeaveDecision = "approved" | "rejected";

/** Yêu cầu trực tiếp người dùng (2026-07-16) — "Đơn xin nghỉ phép" mẫu y hệt file đính kèm. */
export interface LeaveRequest {
  id: string;
  account: LeaveRequestPerson;
  employee_position: string | null;
  employee_department: string | null;
  recipient_text: string | null;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  handover_to: string | null;
  status: LeaveRequestStatus;
  leader_decision_by: LeaveRequestPerson | null;
  leader_decision_at: string | null;
  leader_decision: LeaveDecision | null;
  leader_note: string | null;
  admin_decision_by: LeaveRequestPerson | null;
  admin_decision_at: string | null;
  admin_decision: LeaveDecision | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Dự án phụ — nâng cấp toàn diện: Danh sách đưa đón ──────────────────

/**
 * Đối tượng "ShuttleRecord" (Danh sách đưa đón) — module ĐỘC LẬP, nhập tay
 * tự do, không liên kết Lead/module nghiệp vụ khác.
 */
export interface ShuttleRecord {
  id: string;
  date: string;
  full_name: string;
  phone_number: string;
  company: string | null;
  area: string | null;
  type: string | null;
  sale: string | null;
  driver: string | null;
  interview_time: string | null;
  contractor: string | null;
  /** "Tình trạng đón" (Đã đón/Chưa đón được/Hẹn lại). */
  status: string | null;
  /** "Kết quả PV" (Đỗ phỏng vấn/Trượt phỏng vấn) — tách riêng khỏi "Tình trạng đón". */
  interview_result: string | null;
  note: string | null;
  created_by: NamedRef;
  updated_by: NamedRef;
  created_at: string;
  updated_at: string;
}

/** GET /shuttle/options — giá trị đã dùng qua, gợi ý cho form/bộ lọc. */
/** Dự án phụ — nâng cấp toàn diện: mỗi giá trị gợi ý kèm màu nền đã chọn, có thể xóa riêng. */
export interface ShuttleOptionItem {
  id: string;
  value: string;
  color_key: string | null;
  /** Dự án phụ — nâng cấp toàn diện: màu CHỮ riêng, độc lập với color_key (màu nền) — null = dùng màu chữ tương phản tự động theo color_key. */
  text_color_key: string | null;
}

export interface ShuttleOptions {
  companies: ShuttleOptionItem[];
  areas: ShuttleOptionItem[];
  types: ShuttleOptionItem[];
  /** "sale" chỉ lưu MÀU cho tài khoản Sale thật (value = họ tên tài khoản) — không dùng để liệt kê tên (xem SaleAccountItem/listSaleAccounts). */
  sales: ShuttleOptionItem[];
  drivers: ShuttleOptionItem[];
  contractors: ShuttleOptionItem[];
  statuses: ShuttleOptionItem[];
  interviewResults: ShuttleOptionItem[];
  interviewTimes: ShuttleOptionItem[];
}

/** GET /shuttle/sale-accounts — tài khoản role=sale, đang active — nguồn cột "Sale" (yêu cầu trực tiếp người dùng: lấy từ danh sách tài khoản để sau này làm báo cáo). */
export interface SaleAccountItem {
  id: string;
  full_name: string;
}

// ── Dự án phụ — nâng cấp toàn diện (2026-07-17): "DS Sale" (module con của
// "Nhập doanh số") — yêu cầu trực tiếp người dùng, xem sales-entry.controller.ts. ──

/** Dùng chung cho cột "Sale" và "Đưa đón" — cả 2 tham chiếu Account thật, kèm avatar + tên nhóm để phân biệt người trùng tên. */
export interface DsSaleAccountOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
  team_name: string | null;
}

/** Cột "Công ty làm" — chưa có bảng công ty hợp tác thật, giữ hình dạng ổn định sẵn cho khi có nguồn thật (xem GET /sales-entry/ds-sale/companies). */
export interface DsSaleCompanyOption {
  id: string;
  name: string;
}

export interface DsSaleRow {
  id: string;
  employee_code: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  identity_number: string | null;
  hometown: string | null;
  join_date: string | null;
  company: DsSaleCompanyOption | null;
  sale: DsSaleAccountOption | null;
  pickup: DsSaleAccountOption | null;
  note: string | null;
  created_by: NamedRef;
  updated_by: NamedRef;
  created_at: string;
  updated_at: string;
}

/** Payload gửi lên khi tạo mới/lưu lại 1 dòng DS Sale (POST/PUT) — mọi trường đều tùy chọn, dòng trống hoàn toàn bị chặn ở service backend. */
export interface DsSaleRowInput {
  employee_code?: string;
  full_name?: string;
  date_of_birth?: string | null;
  identity_number?: string;
  hometown?: string;
  join_date?: string | null;
  company_id?: string | null;
  sale_user_id?: string | null;
  pickup_user_id?: string | null;
  note?: string;
}

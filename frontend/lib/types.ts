// Kiểu dữ liệu khớp với "Đối tượng dữ liệu dùng chung" — Mục 0.1, docs/13-api-design.md.

export type AccountRole = "admin" | "manager" | "leader" | "mkt" | "sale";
export type AccountStatus = "active" | "inactive";

export const ACCOUNT_ROLE_LABEL: Record<AccountRole, string> = {
  admin: "Admin",
  manager: "Quản lý",
  leader: "Leader",
  mkt: "MKT",
  sale: "Sale",
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
  created_at: string;
  updated_at: string;
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
  type: "callback_reminder" | "interview_reminder" | "admin_message";
  channel: string;
  /** Dự án phụ — nâng cấp toàn diện: nội dung tự soạn khi type=admin_message, null với 2 loại nhắc lịch cũ. */
  content: string | null;
  /** Dự án phụ — nâng cấp toàn diện: người gửi khi type=admin_message, null với 2 loại nhắc lịch cũ (hệ thống tự tạo). */
  sender: { id: string; name: string; role: AccountRole; avatar_url: string | null } | null;
  scheduled_at: string;
  sent_at: string | null;
  status: "pending" | "sent" | "failed";
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

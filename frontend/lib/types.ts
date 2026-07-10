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
  uploaded_by: NamedRef;
  uploaded_at: string;
  assigned_to: NamedRef | null;
  assigned_team_id: string | null;
  assigned_at: string | null;
  assignment_method: string | null;
  call_status: NamedRef | null;
  call_result: NamedRef | null;
  current_interview_status: NamedRef | null;
  current_employment_status: NamedRef | null;
  current_partner_company_name: string | null;
  is_held: boolean;
  held_by: NamedRef | null;
  held_at: string | null;
  last_activity_at: string | null;
  entered_care_pool_at: string | null;
  care_pool_locked_by: NamedRef | null;
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

export type StatusCategory = "call_status" | "call_result" | "interview_status" | "employment_status";

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
  created_by: NamedRef;
  content: string;
  call_status: NamedRef | null;
  call_result: NamedRef | null;
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
  created_by: NamedRef;
  created_at: string;
}

/** Đối tượng "Callback" — Mục 0.1, docs/13-api-design.md. */
export interface Callback {
  id: string;
  lead_id: string;
  scheduled_at: string;
  is_completed: boolean;
  created_by: NamedRef;
  created_at: string;
}

/** GET /calendar — Mục 7, docs/13-api-design.md. */
export interface CalendarEvent {
  type: "interview" | "callback";
  id: string;
  scheduled_at: string;
  candidate: { id: string; full_name: string; phone_number: string };
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

/** GET /dashboard/summary — Mục 8, docs/13-api-design.md. */
export interface DashboardSummary {
  new_leads_total: number;
  new_leads_by_source: Array<{ source_id: string; source_name: string; count: number }>;
  pending_count: number;
  funnel: FunnelStep[];
  care_pool_count: number;
}

/** GET /dashboard/performance — Mục 8, docs/13-api-design.md. */
export interface SalePerformance {
  account_id: string;
  full_name: string;
  calls: number;
  potential_leads: number;
  interview_count: number;
  employed_count: number;
}

/** GET /dashboard/by-team — Mục 8, docs/13-api-design.md. */
export interface TeamSummary {
  team_id: string;
  team_name: string;
  lead_count: number;
  conversion_rate: number;
  care_pool_count: number;
}

/** GET /report/by-source — Mục 8, docs/13-api-design.md. */
export interface BySourceReport {
  source_id: string;
  source_name: string;
  lead_count: number;
  potential_rate: number;
  employed_rate: number;
}

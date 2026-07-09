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

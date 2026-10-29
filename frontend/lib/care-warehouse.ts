import type { AccountRole, Candidate } from "@/lib/types";

/**
 * Kho chăm sóc (2026-10-28) — kiểu dữ liệu khớp đúng response của
 * backend/src/care-warehouse/care-warehouse.service.ts.
 */

export interface CareAccountRef {
  id: string;
  name: string;
  nickname: string | null;
  role: AccountRole;
  avatar_url: string | null;
}

export type CareMonthStatus = "cared" | "not_cared";

export interface CareInfo {
  month_status: CareMonthStatus;
  month_care_count: number;
  total_care_count: number;
  last_care_at: string | null;
  last_care_by: CareAccountRef | null;
  last_care_result: {
    call_status: { id: string; name: string } | null;
    call_result: { id: string; name: string } | null;
    content: string;
  } | null;
  open_assignment: {
    id: string;
    assignee: CareAccountRef | null;
    assigned_at: string;
    processed: boolean;
  } | null;
  assigned_pending: boolean;
  last_assigned_at: string | null;
}

export type CareWarehouseItem = Candidate & { care: CareInfo };

export interface CareWarehouseStats {
  total: number;
  cared: number;
  not_cared: number;
  assigned_pending: number;
  care_turns_month: number;
  care_turns_total: number;
  mine_assigned: number;
  mine_pending: number;
  /** Được giao / Đã xử lý / Chưa xử lý theo khoảng ngày đã chọn (Sale: của chính mình). */
  range: {
    from: string | null;
    to: string;
    assigned: number;
    processed: number;
    pending: number;
  };
}

export interface CareWarehouseListResult {
  total: number;
  page: number;
  page_size: number;
  month: string;
  stats: CareWarehouseStats;
  items: CareWarehouseItem[];
}

export type CareSkipReason =
  | "not_eligible"
  | "out_of_scope"
  | "team_mismatch"
  | "duplicate_in_request"
  | "already_assigned_same"
  | "assigned_to_other";

export interface CareAssignResult {
  batch_id: string | null;
  assigned: { lead_id: string; assignee_id: string }[];
  skipped: { lead_id: string; assignee_id: string; reason: CareSkipReason; message: string }[];
}

export interface CareRandomPreview {
  requested_total: number;
  available_total: number;
  picked_total: number;
  shortage: boolean;
  by_priority: { 1: number; 2: number; 3: number };
  per_assignee: { assignee: CareAccountRef; requested: number; picked: number }[];
  pairs: {
    lead_id: string;
    assignee_id: string;
    priority: 1 | 2 | 3;
    full_name: string;
    phone_number: string;
  }[];
}

export type CareAssignmentMethod = "manual" | "random" | "self";
export type CareEndReason = "revoked" | "reassigned" | "stopped";

export interface CareAssignmentRow {
  id: string;
  batch_id: string;
  lead: { id: string; full_name: string; phone_number: string };
  assignee: CareAccountRef;
  assigned_at: string;
  ended_at: string | null;
  ended_by: CareAccountRef | null;
  end_reason: CareEndReason | null;
}

export interface CareBatch {
  id: string;
  method: CareAssignmentMethod;
  created_at: string;
  created_by: CareAccountRef;
  lead_count: number;
  assignments: CareAssignmentRow[];
}

/** GET /care-progress — khối Dashboard và tab "Tiến độ chăm sóc" dùng chung. */
export interface CareDailyMetrics {
  today: { assigned: number; processed: number; pending: number };
  completion_rate: number | null;
  backlog: { start: number; processed: number; remaining: number };
  care_turns: number;
}

export interface CareMonthlyMetrics {
  assigned: number;
  processed: number;
  pending: number;
  care_turns: number;
  last_care_at: string | null;
}

export interface CareProgressRow {
  account: CareAccountRef;
  team: { id: string; name: string } | null;
  daily: CareDailyMetrics;
  monthly: CareMonthlyMetrics;
}

export interface CareProgressResult {
  date: string;
  month: string;
  rows: CareProgressRow[];
  totals: { daily: CareDailyMetrics; monthly: CareMonthlyMetrics };
  target: { eligible: number; cared: number; not_cared: number; rate: number | null };
}

export const CARE_METHOD_LABEL: Record<CareAssignmentMethod, string> = {
  manual: "Thủ công",
  random: "Ngẫu nhiên",
  self: "Sale tự nhận",
};

export const CARE_END_REASON_LABEL: Record<CareEndReason, string> = {
  revoked: "Đã thu hồi",
  reassigned: "Đã giao lại",
  stopped: "Dừng chăm sóc",
};

export const CARE_PRIORITY_LABEL: Record<1 | 2 | 3, string> = {
  1: "Chưa chăm sóc, chưa giao",
  2: "Đã giao, chưa chăm sóc",
  3: "Đã chăm sóc trong tháng",
};

export function formatCareDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Loại sự kiện realtime có thể làm data vào/ra Kho hoặc đổi trạng thái chăm sóc. */
export const CARE_RELEVANT_CHANGES = new Set([
  "created",
  "updated",
  "deleted",
  "assigned",
  "transferred",
  "note_created",
  "note_deleted",
  "care_assigned",
  "care_revoked",
  "care_stopped",
  "care_resumed",
  "care_stop_requested",
  "care_stop_rejected",
]);

import type { AccountRole, Candidate } from "./types";

/**
 * Quyền thao tác trên 1 data lao động phía giao diện — DÙNG CHUNG cho trang
 * danh sách và trang chi tiết (rà soát 2026-10-30; trước đây mỗi trang tự
 * viết 1 bản và từng lệch nhau). Mỗi hàm khớp đúng 1 hàm kiểm tra ở backend;
 * backend vẫn là lớp chặn thật, đây chỉ để ẩn/hiện nút cho đúng.
 *
 * Phân quyền chi tiết (2026-11-07): kiểm theo quyền nhỏ (`caps`, lấy từ
 * GET /me) thay vì vai trò — khớp capability-catalog.ts ở backend.
 *
 * Số đang được giữ (2026-11-06): CHỈ người giữ thao tác được — mọi người
 * khác (kể cả Leader/Quản lý/Admin) đều bị chặn, chỉ còn quyền bỏ giữ số.
 */
export interface LeadViewer {
  id: string;
  role: AccountRole;
  teamId: string | null;
  /** Quyền nhỏ hiệu lực (GET /me → capabilities). */
  caps: readonly string[];
}

type LeadLike = Pick<Candidate, "assigned_to" | "assigned_team_id" | "last_activity_at" | "is_held" | "held_by">;

const has = (viewer: LeadViewer, code: string) => viewer.caps.includes(code);

const inViewerTeam = (lead: LeadLike, viewer: LeadViewer) =>
  viewer.teamId !== null && lead.assigned_team_id === viewer.teamId;

export const heldByOther = (lead: LeadLike, viewer: LeadViewer) => lead.is_held && lead.held_by?.id !== viewer.id;

/**
 * Sửa thông tin data (form Sửa) — khớp assertCanModify(): data người khác
 * đang giữ số thì chặn (cả Admin); lead.edit_all mọi data; data mình phụ
 * trách; lead.edit_team nhóm mình; lead.edit_help data cùng nhóm đã được xử lý ≥1 lần.
 */
export function canEditLead(lead: LeadLike, viewer: LeadViewer): boolean {
  if (heldByOther(lead, viewer)) return false;
  if (has(viewer, "lead.edit_all")) return true;
  if (lead.assigned_to?.id === viewer.id) return true;
  if (!inViewerTeam(lead, viewer)) return false;
  if (has(viewer, "lead.edit_team")) return true;
  return has(viewer, "lead.edit_help") && lead.last_activity_at !== null;
}

/**
 * Xử lý data (ghi chú, trạng thái cuộc gọi, Kết quả, Zalo, lịch PV, gọi lại)
 * — khớp loadLeadForUpdate(): data người khác đang giữ số thì chặn (cả
 * Admin); lead.process_all mọi data; data mình phụ trách; lead.edit_team
 * nhóm mình; lead.edit_help mọi data trong nhóm đã có người phụ trách.
 */
export function canProcessLead(lead: LeadLike, viewer: LeadViewer): boolean {
  if (heldByOther(lead, viewer)) return false;
  if (has(viewer, "lead.process_all")) return true;
  if (lead.assigned_to?.id === viewer.id) return true;
  if (!inViewerTeam(lead, viewer)) return false;
  if (has(viewer, "lead.edit_team")) return true;
  return has(viewer, "lead.edit_help") && lead.assigned_to !== null;
}

/** Xoá (mềm) data — khớp assertCanDelete(): quyền lead.delete (số người khác đang giữ bị bỏ qua). */
export function canDeleteLeads(viewer: Pick<LeadViewer, "caps">): boolean {
  return viewer.caps.includes("lead.delete");
}

/**
 * Sửa nhanh Năm sinh/Địa chỉ — khớp assertCanQuickEdit(): người được sửa
 * hoặc được xử lý hộ data; data người khác đang giữ số thì chặn (cả Admin).
 */
export function canQuickEditLead(lead: LeadLike, viewer: LeadViewer): boolean {
  if (heldByOther(lead, viewer)) return false;
  return canEditLead(lead, viewer) || canProcessLead(lead, viewer);
}

/** Thao tác trong nhóm mình, hoặc mọi nhóm nếu có lead.manage_all_teams. */
const inManageScope = (lead: LeadLike, viewer: LeadViewer) =>
  has(viewer, "lead.manage_all_teams") || inViewerTeam(lead, viewer);

/**
 * Giữ / bỏ giữ số — khớp setHold(): số chưa giữ thì người có lead.hold giữ
 * được; số đang giữ thì người giữ, hoặc người có lead.unhold_others (trong
 * phạm vi nhóm) bỏ giữ được — không ai giữ đè lên số người khác đang giữ.
 */
export function canToggleHold(lead: LeadLike, viewer: LeadViewer): boolean {
  if (lead.is_held) {
    if (lead.held_by?.id === viewer.id) return true;
    return has(viewer, "lead.unhold_others") && inManageScope(lead, viewer);
  }
  return has(viewer, "lead.hold");
}

/** Duyệt/từ chối đề nghị đóng data — khớp decideStopRequest(): care.decide_stop, trong phạm vi nhóm. */
export function canDecideStop(lead: LeadLike, viewer: LeadViewer): boolean {
  return has(viewer, "care.decide_stop") && inManageScope(lead, viewer);
}

/** Sửa/xoá 1 ghi chú — khớp updateNote()/deleteNote(): ghi chú của mình, hoặc note.manage_others trong phạm vi nhóm. */
export function canManageNote(lead: LeadLike, noteAuthorId: string, viewer: LeadViewer): boolean {
  if (noteAuthorId === viewer.id) return true;
  return has(viewer, "note.manage_others") && inManageScope(lead, viewer);
}

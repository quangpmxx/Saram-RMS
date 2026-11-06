import type { AccountRole, Candidate } from "./types";

/**
 * Quyền thao tác trên 1 data lao động phía giao diện — DÙNG CHUNG cho trang
 * danh sách và trang chi tiết (rà soát 2026-10-30; trước đây mỗi trang tự
 * viết 1 bản và từng lệch nhau). Mỗi hàm khớp đúng 1 hàm kiểm tra ở backend;
 * backend vẫn là lớp chặn thật, đây chỉ để ẩn/hiện nút cho đúng.
 *
 * Số đang được giữ (2026-11-06): CHỈ người giữ thao tác được — mọi người
 * khác (kể cả Leader/Quản lý/Admin) đều bị chặn, chỉ còn quyền bỏ giữ số.
 */
export interface LeadViewer {
  id: string;
  role: AccountRole;
  teamId: string | null;
}

type LeadLike = Pick<Candidate, "assigned_to" | "assigned_team_id" | "last_activity_at" | "is_held" | "held_by">;

const inViewerTeam = (lead: LeadLike, viewer: LeadViewer) =>
  viewer.teamId !== null && lead.assigned_team_id === viewer.teamId;

export const heldByOther = (lead: LeadLike, viewer: LeadViewer) => lead.is_held && lead.held_by?.id !== viewer.id;

/**
 * Sửa thông tin data (form Sửa) — khớp assertCanModify(): data người khác
 * đang giữ số thì chặn (cả Admin); Admin/Quản lý/MKT mọi data; Leader nhóm
 * mình; Sale data mình phụ trách hoặc data cùng nhóm đã được xử lý ≥1 lần.
 */
export function canEditLead(lead: LeadLike, viewer: LeadViewer): boolean {
  if (heldByOther(lead, viewer)) return false;
  if (viewer.role === "admin" || viewer.role === "manager" || viewer.role === "mkt") return true;
  if (viewer.role === "leader") return inViewerTeam(lead, viewer);
  if (viewer.role === "sale") {
    if (lead.assigned_to?.id === viewer.id) return true;
    return inViewerTeam(lead, viewer) && lead.last_activity_at !== null;
  }
  return false;
}

/**
 * Xử lý data (ghi chú, trạng thái cuộc gọi, Kết quả, Zalo, lịch PV, gọi lại)
 * — khớp loadLeadForUpdate(): data người khác đang giữ số thì chặn (cả
 * Admin); Admin/Quản lý mọi data; Leader nhóm mình; Sale data mình phụ trách
 * hoặc mọi data trong nhóm đã có người phụ trách.
 */
export function canProcessLead(lead: LeadLike, viewer: LeadViewer): boolean {
  if (heldByOther(lead, viewer)) return false;
  if (viewer.role === "admin" || viewer.role === "manager") return true;
  if (viewer.role === "leader") return inViewerTeam(lead, viewer);
  if (viewer.role === "sale") {
    if (lead.assigned_to?.id === viewer.id) return true;
    return inViewerTeam(lead, viewer) && lead.assigned_to !== null;
  }
  return false;
}

/** Xoá (mềm) data — khớp assertCanDelete(): Admin, Quản lý, MKT (số người khác đang giữ bị bỏ qua). */
export function canDeleteLeads(role: AccountRole): boolean {
  return role === "admin" || role === "manager" || role === "mkt";
}

/**
 * Sửa nhanh Năm sinh/Địa chỉ — khớp assertCanQuickEdit(): người được sửa
 * hoặc được xử lý hộ data; data người khác đang giữ số thì chặn (cả Admin).
 */
export function canQuickEditLead(lead: LeadLike, viewer: LeadViewer): boolean {
  if (heldByOther(lead, viewer)) return false;
  return canEditLead(lead, viewer) || canProcessLead(lead, viewer);
}

/**
 * Giữ / bỏ giữ số — khớp setHold(): số chưa giữ thì Admin/Quản lý/Sale giữ
 * được; số đang giữ thì người giữ, Admin, Quản lý, Leader (nhóm của data)
 * bỏ giữ được — không ai giữ đè lên số người khác đang giữ.
 */
export function canToggleHold(lead: LeadLike, viewer: LeadViewer): boolean {
  if (lead.is_held) {
    if (lead.held_by?.id === viewer.id) return true;
    if (viewer.role === "admin" || viewer.role === "manager") return true;
    return viewer.role === "leader" && inViewerTeam(lead, viewer);
  }
  return viewer.role === "admin" || viewer.role === "manager" || viewer.role === "sale";
}

/** Duyệt/từ chối đề nghị đóng data — khớp decideStopRequest(): Leader nhóm của data, Quản lý, Admin. */
export function canDecideStop(lead: LeadLike, viewer: LeadViewer): boolean {
  if (viewer.role === "admin" || viewer.role === "manager") return true;
  return viewer.role === "leader" && inViewerTeam(lead, viewer);
}

/** Bộ lọc trạng thái data ở tab Tất cả (yêu cầu người dùng 2026-10-30) — khớp lead_state của GET /candidate. */
export const LEAD_STATE_OPTIONS = [
  { value: "held", label: "Đã giữ" },
  { value: "pending_close", label: "Chờ đóng" },
  { value: "closed", label: "Đã đóng" },
] as const;

/** "" = tất cả trạng thái. */
export type LeadStateFilter = "" | (typeof LEAD_STATE_OPTIONS)[number]["value"];

export function parseLeadState(value: string | null | undefined): LeadStateFilter {
  return LEAD_STATE_OPTIONS.find((option) => option.value === value)?.value ?? "";
}

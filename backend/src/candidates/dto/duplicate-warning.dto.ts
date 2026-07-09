/**
 * Cảnh báo trùng SĐT — Mục 4, docs/13-api-design.md ("kèm cảnh báo
 * duplicate_warning... gồm danh sách ngày/nhân viên đã trùng").
 */
export interface DuplicateWarningEntry {
  lead_id: string;
  uploaded_at: string;
  uploaded_by: string;
}

export interface DuplicateWarning {
  phone_number: string;
  matches: DuplicateWarningEntry[];
}

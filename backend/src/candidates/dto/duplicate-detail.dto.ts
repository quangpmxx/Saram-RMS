/**
 * Chi tiết trùng SĐT khi hover/click badge "Trùng SĐT" trên danh sách —
 * Mục 2.1, docs/12-ui-design.md ("Tooltip/popup nhanh... hiển thị danh sách
 * các lần trùng"); phân quyền theo Mục 10.4, docs/09-business-specification.md
 * + xác nhận bổ sung của chủ doanh nghiệp cho vai trò Leader/Sale.
 */
export interface DuplicateDetailMatch {
  lead_id: string;
  full_name: string;
  uploaded_at: string;
  assigned_to: { id: string; name: string } | null;
  team_name: string | null;
  status_label: string;
}

export interface DuplicateDetailDto {
  phone_number: string;
  /** false = người xem không có quyền/không có bản ghi nào được phép xem chi tiết. */
  visible: boolean;
  matches: DuplicateDetailMatch[];
}

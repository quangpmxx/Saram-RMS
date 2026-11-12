/**
 * Văn phòng (2026-11-12, yêu cầu người dùng): mỗi nhân viên thuộc 1 văn phòng —
 * quyết định họ nằm ở bảng Chấm công / Check in GPS / Đơn nghỉ phép của văn
 * phòng nào, và check in GPS theo vị trí văn phòng nào. Khớp frontend
 * `lib/types.ts` (OFFICES / OFFICE_LABEL).
 */
export const OFFICES = ['hanoi', 'bac_ninh', 'bac_giang'] as const;
export type Office = (typeof OFFICES)[number];

/** Phần mềm chạy cho VP Hà Nội từ trước — tài khoản/cấu hình cũ đều thuộc Hà Nội. */
export const DEFAULT_OFFICE: Office = 'hanoi';

export const OFFICE_LABEL: Record<Office, string> = {
  hanoi: 'VP Hà Nội',
  bac_ninh: 'VP Bắc Ninh',
  bac_giang: 'VP Bắc Giang',
};

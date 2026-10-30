import type { AccountRole } from '../../../generated/prisma/enums';

/**
 * Nhãn hiển thị của vai trò — khớp ACCOUNT_ROLE_LABEL ở frontend
 * (lib/types.ts). Dùng chung cho xuất Excel, nội dung thông báo, đơn nghỉ
 * (rà soát 2026-10-30 — trước đây khai báo lại ở 3 nơi).
 */
export const ROLE_LABEL: Record<AccountRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  leader: 'Leader',
  mkt: 'NV MKT',
  sale: 'NV Sale',
  accounting: 'Kế toán',
  order_staff: 'NV QL Đơn hàng',
  shuttle_staff: 'NV Đưa đón',
};

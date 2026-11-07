import type { AccountRole } from '../../../generated/prisma/enums';

/**
 * Vai trò "làm việc như Sale" (2026-11-07): Sale và Sup Leader — nhận data,
 * nằm trong vòng chia tự động, tính hiệu suất/xếp hạng, nộp báo cáo hằng
 * ngày, có trong ô chọn Sale (Đưa đón, Nhập doanh số, Kho chăm sóc...).
 * Quyền nhỏ của Sup Leader mặc định như Sale (capability-catalog.ts).
 */
export const SALE_ROLES: AccountRole[] = ['sale', 'sup_leader'];

export function isSaleRole(role: string): boolean {
  return (SALE_ROLES as string[]).includes(role);
}

/**
 * Người chọn được ở cột "Sale" của Danh sách đưa đón và Nhập doanh số
 * (2026-11-07): Sale/Sup Leader và cả Leader — Leader cũng có thể tự tuyển
 * được người.
 */
export const RECRUITER_ROLES: AccountRole[] = ['leader', ...SALE_ROLES];

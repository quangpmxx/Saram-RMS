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
 * Leader được nhận data (2026-11-20): Leader được Admin bật riêng quyền "Tự nhận
 * data chờ phân chia" (lead.claim — mặc định Leader không có) thì tự nhận + được
 * chia/chuyển data như Sale. KHÔNG vào vòng chia tự động, KHÔNG vào Kho chăm sóc.
 */
export const RECEIVER_LEADER_WHERE = {
  role: 'leader' as const,
  capabilityOverrides: { some: { code: 'lead.claim', granted: true } },
};

/** Điều kiện Prisma: tài khoản nhận được data (Sale/Sup Leader + Leader được bật quyền). */
export const LEAD_RECEIVER_WHERE = {
  OR: [{ role: { in: SALE_ROLES } }, RECEIVER_LEADER_WHERE],
};

/** Tài khoản nhận được data không — `overrides` là quyền chỉnh riêng của chính tài khoản đó. */
export function isLeadReceiver(
  role: string,
  overrides: { code: string; granted: boolean }[] = [],
): boolean {
  if (isSaleRole(role)) return true;
  return (
    role === 'leader' &&
    overrides.some((o) => o.code === 'lead.claim' && o.granted)
  );
}

/**
 * Người chọn được ở cột "Sale" của Danh sách đưa đón và Nhập doanh số
 * (2026-11-07): Sale/Sup Leader và cả Leader — Leader cũng có thể tự tuyển
 * được người.
 */
export const RECRUITER_ROLES: AccountRole[] = ['leader', ...SALE_ROLES];

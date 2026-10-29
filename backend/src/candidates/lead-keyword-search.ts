import type { Prisma } from '../../generated/prisma/client';

/**
 * Điều kiện tìm kiếm chung cho ô "Tìm kiếm" của tab Tất cả (GET /candidate)
 * và Kho chăm sóc (GET /care-warehouse) — yêu cầu người dùng 2026-10-29:
 * ngoài tên/SĐT còn khớp ghi chú (ghi chú chăm sóc chưa xóa + ghi chú MKT),
 * địa chỉ và năm sinh (khi gõ đúng 1 năm dạng 19xx/20xx).
 *
 * Trả về null nếu từ khóa rỗng (không lọc).
 */
export function buildLeadKeywordWhere(
  keyword: string | undefined,
): Prisma.LeadWhereInput | null {
  const term = keyword?.trim();
  if (!term) return null;

  const or: Prisma.LeadWhereInput[] = [
    { fullName: { contains: term, mode: 'insensitive' } },
    { phoneNumber: { contains: term } },
    { address: { contains: term, mode: 'insensitive' } },
    { mktNote: { contains: term, mode: 'insensitive' } },
    {
      notes: {
        some: {
          content: { contains: term, mode: 'insensitive' },
          isDeleted: false,
        },
      },
    },
  ];
  // Chỉ coi là năm sinh khi đúng dạng 19xx/20xx — "0901" (đầu SĐT) không phải năm.
  if (/^(19|20)\d{2}$/.test(term)) {
    or.push({ birthYear: Number(term) });
  }
  return { OR: or };
}

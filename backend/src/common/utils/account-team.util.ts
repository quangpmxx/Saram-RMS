import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Nhóm của 1 tài khoản (null nếu chưa thuộc nhóm nào). Dùng chung cho mọi
 * service cần giới hạn phạm vi "nhóm mình" của Leader/Sale (rà soát
 * 2026-10-30 — trước đây mỗi service tự viết lại 1 bản giống hệt).
 */
export async function findOwnTeamId(
  prisma: Pick<PrismaService, 'account'>,
  accountId: string,
): Promise<string | null> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  return account?.teamId ?? null;
}

import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * POST /candidate bắt buộc `team_id` (MKT chọn nhóm ngay khi up data — xem
 * CreateCandidateDto). Các bộ test tạo data rồi cho Leader phân cho 1 Sale
 * → data phải thuộc đúng nhóm của Sale đó, khớp nghiệp vụ thật.
 */
export async function teamOf(
  prisma: PrismaService,
  accountId: string,
): Promise<string> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { teamId: true },
  });
  if (!account.teamId) {
    throw new Error(`Tài khoản test ${accountId} chưa thuộc nhóm nào`);
  }
  return account.teamId;
}

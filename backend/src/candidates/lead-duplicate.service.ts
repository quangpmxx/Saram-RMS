import { Injectable } from '@nestjs/common';
import { Lead } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dùng chung giữa CandidatesService (nhập tay) và ImportsService (import
 * Excel) — cùng một quy tắc phát hiện trùng SĐT (Mục 10.4, docs/09).
 */
@Injectable()
export class LeadDuplicateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đồng bộ cờ trùng lặp cho TẤT CẢ bản ghi cùng SĐT (không chỉ bản ghi mới)
   * — đúng khuyến nghị Mục 9.2, docs/11-database-design.md.
   */
  async syncDuplicateFlags(phoneNumber: string): Promise<Lead[]> {
    const matches = await this.prisma.lead.findMany({
      where: { phoneNumber, deletedAt: null },
    });
    if (matches.length === 0) {
      return matches;
    }

    await this.prisma.lead.updateMany({
      where: { id: { in: matches.map((match) => match.id) } },
      data: { isDuplicateFlagged: matches.length > 1 },
    });

    return matches;
  }
}

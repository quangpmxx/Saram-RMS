import { Injectable } from '@nestjs/common';
import { Lead } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Chu kỳ lọc trùng SĐT: chỉ tính trùng khi 2 lần up cách nhau dưới 7 ngày. */
export const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isWithinDuplicateWindow(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) < DUPLICATE_WINDOW_MS;
}

/**
 * Dùng chung giữa CandidatesService (nhập tay) và ImportsService (import
 * Excel) — cùng một quy tắc phát hiện trùng SĐT.
 */
@Injectable()
export class LeadDuplicateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Nhóm đang giữ số gốc: lần up SỚM NHẤT của SĐT này trong 7 ngày gần nhất
   * (có nhóm). Số trùng up mới sẽ tự chuyển về nhóm này.
   */
  async findOriginTeam(
    phoneNumber: string,
    now: Date = new Date(),
  ): Promise<{ id: string; name: string } | null> {
    const origin = await this.prisma.lead.findFirst({
      where: {
        phoneNumber,
        deletedAt: null,
        assignedTeamId: { not: null },
        uploadedAt: { gt: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { uploadedAt: 'asc' },
      select: { assignedTeamId: true },
    });
    if (!origin?.assignedTeamId) return null;
    return this.prisma.team.findUnique({
      where: { id: origin.assignedTeamId },
      select: { id: true, name: true },
    });
  }

  /**
   * Đồng bộ cờ trùng cho TẤT CẢ bản ghi cùng SĐT: một bản ghi bị đánh dấu
   * trùng khi có bản ghi khác cùng SĐT up cách nó dưới 7 ngày.
   */
  async syncDuplicateFlags(phoneNumber: string): Promise<Lead[]> {
    const matches = await this.prisma.lead.findMany({
      where: { phoneNumber, deletedAt: null },
    });
    if (matches.length === 0) {
      return matches;
    }

    const flagged: string[] = [];
    const unflagged: string[] = [];
    for (const lead of matches) {
      const dup = matches.some(
        (other) =>
          other.id !== lead.id &&
          isWithinDuplicateWindow(other.uploadedAt, lead.uploadedAt),
      );
      (dup ? flagged : unflagged).push(lead.id);
    }
    if (flagged.length > 0) {
      await this.prisma.lead.updateMany({
        where: { id: { in: flagged } },
        data: { isDuplicateFlagged: true },
      });
    }
    if (unflagged.length > 0) {
      await this.prisma.lead.updateMany({
        where: { id: { in: unflagged } },
        data: { isDuplicateFlagged: false },
      });
    }

    return matches;
  }
}

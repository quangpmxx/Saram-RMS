import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CalendarQueryDto } from './dto/calendar-query.dto';

export interface CalendarEventDto {
  type: 'interview' | 'callback';
  id: string;
  scheduled_at: string;
  candidate: { id: string; full_name: string; phone_number: string };
}

/** Mục 2.6 & 8, docs/09: Admin/Quản lý/MKT xem toàn bộ, không giới hạn nhóm. */
const FULL_ACCESS_ROLES = new Set(['admin', 'manager', 'mkt']);

/**
 * Mục 7, docs/13-api-design.md — GET /calendar: gộp lịch hẹn PV + lịch gọi
 * lại theo khoảng thời gian, phục vụ màn hình Lịch hẹn (S10, tài liệu 10;
 * Mục 7, tài liệu 12).
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(
    query: CalendarQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<CalendarEventDto[]> {
    const leadWhere = await this.buildLeadScopeWhere(currentUser, query);
    const scheduledAt = {
      gte: query.date_from ? new Date(query.date_from) : undefined,
      lte: query.date_to ? new Date(query.date_to) : undefined,
    };

    const [interviews, callbacks] = await Promise.all([
      this.prisma.interviewAppointment.findMany({
        where: { scheduledAt, lead: leadWhere },
        include: {
          lead: { select: { id: true, fullName: true, phoneNumber: true } },
        },
      }),
      this.prisma.callbackSchedule.findMany({
        where: { scheduledAt, lead: leadWhere },
        include: {
          lead: { select: { id: true, fullName: true, phoneNumber: true } },
        },
      }),
    ]);

    const events: CalendarEventDto[] = [
      ...interviews.map((interview) => ({
        type: 'interview' as const,
        id: interview.id,
        scheduled_at: interview.scheduledAt.toISOString(),
        candidate: {
          id: interview.lead.id,
          full_name: interview.lead.fullName,
          phone_number: interview.lead.phoneNumber,
        },
      })),
      ...callbacks.map((callback) => ({
        type: 'callback' as const,
        id: callback.id,
        scheduled_at: callback.scheduledAt.toISOString(),
        candidate: {
          id: callback.lead.id,
          full_name: callback.lead.fullName,
          phone_number: callback.lead.phoneNumber,
        },
      })),
    ];

    return events.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  /**
   * Mục 0, docs/13: "phạm vi dữ liệu trả về áp dụng ngầm định" — tái dùng
   * đúng quy tắc Mục 8, docs/09 (Sale: lead của mình; Leader: cả nhóm; còn
   * lại: toàn bộ), kết hợp thêm filter team_id/account_id trong giới hạn
   * phạm vi (không cho vượt ra ngoài, giống buildScopeWhere của Candidate).
   */
  private async buildLeadScopeWhere(
    currentUser: AuthenticatedUser,
    query: CalendarQueryDto,
  ): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = { deletedAt: null };

    if (FULL_ACCESS_ROLES.has(currentUser.role)) {
      if (query.team_id) {
        where.assignedTeamId = query.team_id;
      }
      if (query.account_id) {
        where.assignedToId = query.account_id;
      }
      return where;
    }

    if (currentUser.role === 'leader') {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      where.assignedTeamId = account?.teamId ?? '__none__';
      if (query.account_id) {
        where.assignedToId = query.account_id;
      }
      return where;
    }

    // sale
    where.assignedToId = currentUser.id;
    return where;
  }
}

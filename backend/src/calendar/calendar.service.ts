import { can } from '../common/permissions/capability-catalog';
import { NO_MATCH_UUID } from '../common/utils/no-match-uuid';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { vnDayRange } from '../care-warehouse/care-time.util';

/**
 * Ngày dạng "YYYY-MM-DD" tính theo giờ Việt Nam, lấy trọn ngày (2026-11-27): trước đây
 * new Date("YYYY-MM-DD") = 07:00 sáng giờ VN → mất lịch từ 7h sáng ngày cuối khoảng lọc.
 */
function vnBound(value: string | undefined, edge: 'start' | 'end') {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = vnDayRange(value);
    // end là mốc đầu ngày hôm sau (không tính) → lùi 1ms để dùng với "lte".
    return edge === 'start' ? day.start : new Date(day.end.getTime() - 1);
  }
  return new Date(value);
}

export interface CalendarEventDto {
  type: 'interview' | 'callback';
  id: string;
  scheduled_at: string;
  candidate: { id: string; full_name: string; phone_number: string };
  /**
   * Dự án phụ — nâng cấp toàn diện (yêu cầu trực tiếp người dùng
   * 2026-07-14): Admin cần biết Sale nào đã đặt lịch hẹn này — người tạo
   * lịch hẹn PV/lịch gọi lại, khớp đúng field "created_by" đã có sẵn ở
   * Note/Interview/Callback (dùng chung NameWithRoleHint ở frontend).
   */
  created_by: { id: string; name: string; role: string };
  /** Lịch gọi lại lặp mỗi ngày — mỗi ngày là 1 dòng, cùng id (xoá = xoá cả chuỗi). */
  repeat_daily: boolean;
  /**
   * Chỉ lịch gọi lại (2026-11-27, yêu cầu người dùng): ghi chú đầu tiên của data trong vòng
   * CALLBACK_DONE_WINDOW_MIN phút kể từ giờ hẹn (lúc phần mềm báo nhắc) = đã gọi lại. null = chưa có.
   */
  called_back?: { at: string; by: string } | null;
  /** Chỉ lịch gọi lại: chưa tới giờ / đang trong 30 phút chờ gọi / đã gọi lại / quá 30 phút chưa gọi. */
  callback_state?: 'upcoming' | 'due' | 'done' | 'missed';
}

/** Ghi chú trong khoảng này sau giờ hẹn gọi lại thì tính là "Đã gọi lại". */
export const CALLBACK_DONE_WINDOW_MIN = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Chặn trải quá nhiều ngày khi xem khoảng rất dài. */
const MAX_DAILY_OCCURRENCES = 400;

/**
 * Các lần của 1 lịch "Mỗi ngày" rơi trong [from, to] — cùng giờ mỗi ngày
 * (giờ Việt Nam không đổi giờ mùa hè nên cộng đúng 24h).
 */
export function dailyOccurrences(
  start: Date,
  from: Date | undefined,
  to: Date | undefined,
): Date[] {
  const first =
    from && from > start
      ? Math.ceil((from.getTime() - start.getTime()) / DAY_MS)
      : 0;
  const result: Date[] = [];
  for (let k = first; result.length < MAX_DAILY_OCCURRENCES; k++) {
    const at = new Date(start.getTime() + k * DAY_MS);
    if (to && at > to) break;
    result.push(at);
    if (!to && result.length >= 31) break;
  }
  return result;
}

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
    // Không có quyền xem cả nhóm/toàn công ty: ngoài lịch của data mình
    // phụ trách, còn thấy lịch DO CHÍNH MÌNH ĐẶT dù data đang thuộc người
    // khác/Kho chăm sóc (vd lịch gọi lại khi xử lý hộ) — trước đây bị ẩn,
    // chỉ Sub Leader trở lên mới thấy (yêu cầu người dùng 2026-11-09).
    const isOwnScope =
      !can(currentUser, 'calendar.view_all') &&
      !can(currentUser, 'calendar.view_team');
    const scopeWhere = isOwnScope
      ? {
          OR: [
            { lead: leadWhere },
            { createdById: currentUser.id, lead: { deletedAt: null } },
            // Data đang được giao chăm sóc cho mình (Kho chăm sóc) — lịch người khác đặt cũng hiện.
            {
              lead: {
                deletedAt: null,
                careAssignments: {
                  some: { assigneeId: currentUser.id, endedAt: null },
                },
              },
            },
          ],
        }
      : { lead: leadWhere };
    const scheduledAt = {
      gte: vnBound(query.date_from, 'start'),
      lte: vnBound(query.date_to, 'end'),
    };
    const createdByWhere = query.created_by_id
      ? { createdById: query.created_by_id }
      : {};

    // "Loại lịch" (type) lọc SAU khi gộp 2 danh sách (bên dưới) thay vì bỏ
    // hẳn 1 trong 2 truy vấn — tránh nhánh rẽ điều kiện ngay trong
    // Promise.all() làm TypeScript suy luận sai kiểu trả về (2 nhánh khác
    // kiểu khiến cả mảng bị suy ra `any`) — phí 1 truy vấn không dùng tới
    // khi có lọc type, không đáng kể với quy mô dữ liệu bảng này.
    const [interviews, callbacks] = await Promise.all([
      this.prisma.interviewAppointment.findMany({
        where: {
          scheduledAt,
          deletedAt: null,
          ...scopeWhere,
          ...createdByWhere,
        },
        include: {
          lead: { select: { id: true, fullName: true, phoneNumber: true } },
          createdBy: { select: { id: true, fullName: true, role: true } },
        },
      }),
      this.prisma.callbackSchedule.findMany({
        where: {
          deletedAt: null,
          ...createdByWhere,
          // AND vì cả phạm vi (scopeWhere) lẫn điều kiện thời gian đều dùng OR.
          AND: [
            scopeWhere,
            {
              OR: [
                { repeatDaily: false, scheduledAt },
                {
                  repeatDaily: true,
                  isCompleted: false,
                  ...(scheduledAt.lte
                    ? { scheduledAt: { lte: scheduledAt.lte } }
                    : {}),
                },
              ],
            },
          ],
        },
        include: {
          lead: { select: { id: true, fullName: true, phoneNumber: true } },
          createdBy: { select: { id: true, fullName: true, role: true } },
        },
      }),
    ]);

    const events: CalendarEventDto[] = [
      ...(query.type === 'callback'
        ? []
        : interviews.map((interview) => ({
            type: 'interview' as const,
            id: interview.id,
            scheduled_at: interview.scheduledAt.toISOString(),
            candidate: {
              id: interview.lead.id,
              full_name: interview.lead.fullName,
              phone_number: interview.lead.phoneNumber,
            },
            created_by: {
              id: interview.createdBy.id,
              name: interview.createdBy.fullName,
              role: interview.createdBy.role,
            },
            repeat_daily: false,
          }))),
      ...(query.type === 'interview'
        ? []
        : callbacks.flatMap((callback) =>
            (callback.repeatDaily
              ? dailyOccurrences(
                  callback.scheduledAt,
                  scheduledAt.gte,
                  scheduledAt.lte,
                )
              : [callback.scheduledAt]
            ).map((at) => ({
              type: 'callback' as const,
              id: callback.id,
              scheduled_at: at.toISOString(),
              candidate: {
                id: callback.lead.id,
                full_name: callback.lead.fullName,
                phone_number: callback.lead.phoneNumber,
              },
              created_by: {
                id: callback.createdBy.id,
                name: callback.createdBy.fullName,
                role: callback.createdBy.role,
              },
              repeat_daily: callback.repeatDaily,
            })),
          )),
    ];

    await this.markCalledBack(events);
    return events.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  /** Gắn "đã gọi lại" cho lịch gọi lại đã tới giờ: 1 truy vấn ghi chú cho mọi data liên quan. */
  private async markCalledBack(events: CalendarEventDto[]) {
    const now = Date.now();
    const windowMs = CALLBACK_DONE_WINDOW_MIN * 60 * 1000;
    for (const e of events) {
      if (e.type === 'callback' && Date.parse(e.scheduled_at) > now)
        e.callback_state = 'upcoming';
    }
    const due = events.filter(
      (e) => e.type === 'callback' && Date.parse(e.scheduled_at) <= now,
    );
    if (!due.length) return;
    const times = due.map((e) => Date.parse(e.scheduled_at));
    const notes = await this.prisma.leadNote.findMany({
      where: {
        leadId: { in: [...new Set(due.map((e) => e.candidate.id))] },
        deletedAt: null,
        createdAt: {
          gte: new Date(Math.min(...times)),
          lte: new Date(Math.max(...times) + windowMs),
        },
      },
      select: {
        leadId: true,
        createdAt: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const e of due) {
      const at = Date.parse(e.scheduled_at);
      const hit = notes.find(
        (n) =>
          n.leadId === e.candidate.id &&
          n.createdAt.getTime() >= at &&
          n.createdAt.getTime() <= at + windowMs,
      );
      e.called_back = hit
        ? { at: hit.createdAt.toISOString(), by: hit.createdBy.fullName }
        : null;
      e.callback_state = hit ? 'done' : at + windowMs < now ? 'missed' : 'due';
    }
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

    if (can(currentUser, 'calendar.view_all')) {
      if (query.team_id) {
        where.assignedTeamId = query.team_id;
      }
      if (query.account_id) {
        where.assignedToId = query.account_id;
      }
      return where;
    }

    if (can(currentUser, 'calendar.view_team')) {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      where.assignedTeamId = account?.teamId ?? NO_MATCH_UUID;
      if (query.account_id) {
        where.assignedToId = query.account_id;
      }
      return where;
    }

    // Không có quyền xem cả nhóm/toàn công ty: chỉ lịch data mình phụ trách.
    where.assignedToId = currentUser.id;
    return where;
  }
}

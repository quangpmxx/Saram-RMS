import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { can } from '../common/permissions/capability-catalog';
import { NO_MATCH_UUID } from '../common/utils/no-match-uuid';
import { OFFICE_LABEL, type Office } from '../common/constants/office';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { vnMonthKey } from '../care-warehouse/care-time.util';
import type { AttendanceStatus, Prisma } from '../../generated/prisma/client';
import type {
  MySheetQueryDto,
  RespondSheetDto,
  SendSheetsDto,
  SheetMonthQueryDto,
} from './dto/attendance-sheet.dto';

export interface SheetSummary {
  /** Công chuẩn = số ngày trong tháng trừ Chủ nhật (khớp payroll). */
  standard: number;
  /** Công đi làm thật: ✓ = 1, ½ = 0,5 (khớp CONG_THUC_TE). */
  worked: number;
  paid_leave: number;
  unpaid_leave: number;
  holiday: number;
  compensatory_leave: number;
  /** Công hưởng lương = đi làm + NP + L (khớp CONG_HUONG_LUONG). */
  paid_total: number;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function monthBounds(year: number, month: number) {
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    total,
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month - 1, total)),
  };
}

function standardDays(year: number, month: number): number {
  const { total } = monthBounds(year, month);
  let n = 0;
  for (let d = 1; d <= total; d += 1) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() !== 0) n += 1;
  }
  return n;
}

export function summarizeSheet(
  year: number,
  month: number,
  statuses: AttendanceStatus[],
): SheetSummary {
  const c: Record<string, number> = {};
  for (const s of statuses) c[s] = (c[s] ?? 0) + 1;
  const worked = (c.present ?? 0) + (c.half ?? 0) * 0.5;
  return {
    standard: standardDays(year, month),
    worked,
    paid_leave: c.paid_leave ?? 0,
    unpaid_leave: c.unpaid_leave ?? 0,
    holiday: c.holiday ?? 0,
    compensatory_leave: c.compensatory_leave ?? 0,
    paid_total: worked + (c.paid_leave ?? 0) + (c.holiday ?? 0),
  };
}

const SHEET_LINK_MINE = '/attendance?tab=sheet';
const SHEET_LINK_MANAGE = '/attendance?tab=sheets';

/**
 * Bảng công tháng gửi nhân viên xác nhận (2026-11-14, yêu cầu user): trong
 * tháng nhân viên không xem được công hằng ngày; cuối tháng người có quyền
 * "Sửa bảng chấm công" gửi bảng → nhân viên Đồng ý / Báo sai → báo kế toán
 * chốt lương. Quá hạn không tự coi là đồng ý.
 */
@Injectable()
export class AttendanceSheetService {
  private readonly logger = new Logger(AttendanceSheetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ============================================================ quản lý
  private assertCanManage(user: AuthenticatedUser): void {
    if (!can(user, 'attendance.edit')) {
      throw new ForbiddenException('Bạn không có quyền gửi bảng công');
    }
  }

  private async scopeWhere(
    user: AuthenticatedUser,
    office?: Office,
  ): Promise<Prisma.AccountWhereInput> {
    const base: Prisma.AccountWhereInput = {
      status: 'active',
      attendanceTracked: true,
      ...(office ? { office } : {}),
    };
    if (can(user, 'attendance.view_all')) return base;
    const me = await this.prisma.account.findUnique({
      where: { id: user.id },
      select: { teamId: true },
    });
    return { ...base, teamId: me?.teamId ?? NO_MATCH_UUID };
  }

  private assertNotFuture(year: number, month: number): void {
    const [cy, cm] = vnMonthKey(new Date()).split('-').map(Number);
    if (year * 12 + month > cy * 12 + cm) {
      throw new BadRequestException(
        'Chưa đến tháng này, chưa gửi bảng công được',
      );
    }
  }

  async listForManager(query: SheetMonthQueryDto, user: AuthenticatedUser) {
    this.assertCanManage(user);
    const { year, month } = query;
    const { start, end } = monthBounds(year, month);
    const accounts = await this.prisma.account.findMany({
      where: await this.scopeWhere(user, query.office),
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        office: true,
        team: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    const ids = accounts.map((a) => a.id);
    const [sheets, records] = ids.length
      ? await Promise.all([
          this.prisma.attendanceSheet.findMany({
            where: { accountId: { in: ids }, year, month },
          }),
          this.prisma.attendanceRecord.findMany({
            where: { accountId: { in: ids }, date: { gte: start, lte: end } },
            select: { accountId: true, status: true, updatedAt: true },
          }),
        ])
      : [[], []];
    const sheetBy = new Map(sheets.map((s) => [s.accountId, s]));
    const recBy = new Map<string, typeof records>();
    for (const r of records) {
      const list = recBy.get(r.accountId) ?? [];
      list.push(r);
      recBy.set(r.accountId, list);
    }
    const rows = accounts.map((a) => {
      const s = sheetBy.get(a.id);
      const recs = recBy.get(a.id) ?? [];
      return {
        account_id: a.id,
        full_name: a.fullName,
        avatar_url: a.avatarUrl,
        office: a.office,
        team_name: a.team?.name ?? null,
        summary: summarizeSheet(
          year,
          month,
          recs.map((r) => r.status),
        ),
        sheet: s
          ? {
              status: s.status,
              sent_at: s.sentAt.toISOString(),
              responded_at: s.respondedAt?.toISOString() ?? null,
              note: s.note,
              disputed_days: (s.disputedDays ?? []) as unknown[],
              // Công bị sửa sau khi gửi → nên bấm "Gửi lại" để nhân viên xác nhận số mới.
              edited_after_send: recs.some((r) => r.updatedAt > s.sentAt),
            }
          : null,
      };
    });
    return {
      year,
      month,
      rows,
      counts: {
        total: rows.length,
        unsent: rows.filter((r) => !r.sheet).length,
        pending: rows.filter((r) => r.sheet?.status === 'pending').length,
        confirmed: rows.filter((r) => r.sheet?.status === 'confirmed').length,
        disputed: rows.filter((r) => r.sheet?.status === 'disputed').length,
      },
    };
  }

  async send(dto: SendSheetsDto, user: AuthenticatedUser) {
    this.assertCanManage(user);
    this.assertNotFuture(dto.year, dto.month);
    const { year, month } = dto;
    const where = await this.scopeWhere(user, dto.office);
    let targetIds: string[];
    if (dto.account_ids?.length) {
      const ids = [...new Set(dto.account_ids)];
      const inScope = await this.prisma.account.findMany({
        where: { ...where, id: { in: ids } },
        select: { id: true },
      });
      if (inScope.length !== ids.length) {
        throw new ForbiddenException(
          'Một số nhân viên không thuộc phạm vi chấm công của bạn',
        );
      }
      targetIds = ids;
    } else {
      const accounts = await this.prisma.account.findMany({
        where: {
          ...where,
          attendanceSheets: { none: { year, month } },
        },
        select: { id: true },
      });
      targetIds = accounts.map((a) => a.id);
    }
    if (!targetIds.length) return { sent: 0 };

    const now = new Date();
    await this.prisma.$transaction(
      targetIds.map((accountId) =>
        this.prisma.attendanceSheet.upsert({
          where: { accountId_year_month: { accountId, year, month } },
          create: { accountId, year, month, sentAt: now, sentById: user.id },
          update: {
            status: 'pending',
            sentAt: now,
            sentById: user.id,
            respondedAt: null,
            note: null,
            disputedDays: [],
          },
        }),
      ),
    );
    await this.notify(
      targetIds,
      `Bảng công tháng ${month}/${year} đã có. Bạn vào xem và xác nhận giúp.`,
      user,
      { year, month, link: SHEET_LINK_MINE },
    );
    return { sent: targetIds.length };
  }

  async remind(dto: SheetMonthQueryDto, user: AuthenticatedUser) {
    this.assertCanManage(user);
    const sheets = await this.prisma.attendanceSheet.findMany({
      where: {
        year: dto.year,
        month: dto.month,
        status: 'pending',
        account: await this.scopeWhere(user, dto.office),
      },
      select: { accountId: true },
    });
    const ids = sheets.map((s) => s.accountId);
    await this.notify(
      ids,
      `Nhắc: bạn chưa xác nhận bảng công tháng ${dto.month}/${dto.year}.`,
      user,
      { year: dto.year, month: dto.month, link: SHEET_LINK_MINE },
    );
    return { reminded: ids.length };
  }

  async notifyAccounting(dto: SheetMonthQueryDto, user: AuthenticatedUser) {
    this.assertCanManage(user);
    const { counts } = await this.listForManager(dto, user);
    const accountants = await this.prisma.account.findMany({
      where: { role: 'accounting', status: 'active' },
      select: { id: true },
    });
    if (!accountants.length) {
      throw new BadRequestException(
        'Chưa có tài khoản Kế toán nào đang hoạt động',
      );
    }
    const where = dto.office ? ` (${OFFICE_LABEL[dto.office]})` : '';
    await this.notify(
      accountants.map((a) => a.id),
      `Bảng công tháng ${dto.month}/${dto.year}${where} đã xong: ${counts.confirmed}/${counts.total} người đồng ý. Mời kế toán chốt bảng lương.`,
      user,
      { year: dto.year, month: dto.month, link: '/accounting' },
    );
    return { notified: accountants.length, counts };
  }

  // ============================================================ nhân viên
  async getMine(query: MySheetQueryDto, user: AuthenticatedUser) {
    const sheets = await this.prisma.attendanceSheet.findMany({
      where: { accountId: user.id },
      select: { year: true, month: true, status: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    const months = sheets.map((s) => ({
      year: s.year,
      month: s.month,
      status: s.status,
    }));
    const pick =
      query.year && query.month
        ? sheets.find((s) => s.year === query.year && s.month === query.month)
        : sheets[0];
    if (!pick) return { months, sheet: null };

    const { year, month } = pick;
    const { start, end } = monthBounds(year, month);
    const [sheet, records, me] = await Promise.all([
      this.prisma.attendanceSheet.findUniqueOrThrow({
        where: { accountId_year_month: { accountId: user.id, year, month } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { accountId: user.id, date: { gte: start, lte: end } },
        select: { date: true, status: true, note: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.account.findUnique({
        where: { id: user.id },
        select: { fullName: true, office: true, remainingLeaveDays: true },
      }),
    ]);
    return {
      months,
      sheet: {
        year,
        month,
        full_name: me?.fullName ?? '',
        office: me?.office ?? null,
        remaining_leave_days: me?.remainingLeaveDays ?? null,
        status: sheet.status,
        sent_at: sheet.sentAt.toISOString(),
        responded_at: sheet.respondedAt?.toISOString() ?? null,
        note: sheet.note,
        disputed_days: (sheet.disputedDays ?? []) as unknown[],
        days_in_month: monthBounds(year, month).total,
        records: records.map((r) => ({
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
          note: r.note,
        })),
        summary: summarizeSheet(
          year,
          month,
          records.map((r) => r.status),
        ),
      },
    };
  }

  async respond(dto: RespondSheetDto, user: AuthenticatedUser) {
    const { year, month } = dto;
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { accountId_year_month: { accountId: user.id, year, month } },
    });
    if (!sheet)
      throw new NotFoundException('Bảng công tháng này chưa được gửi cho bạn');
    if (sheet.status === 'confirmed') {
      throw new BadRequestException('Bạn đã đồng ý bảng công tháng này');
    }
    const prefix = `${year}-${pad2(month)}-`;
    const days = (dto.days ?? []).filter((d) => d.date.startsWith(prefix));
    if (dto.action === 'dispute' && !days.length) {
      throw new BadRequestException('Chọn ít nhất 1 ngày bị sai');
    }
    const note = dto.note?.trim() || null;
    // Chỉ cập nhật khi vẫn đang chờ / báo sai — tránh 2 lần bấm cùng lúc ghi đè nhau.
    const updated = await this.prisma.attendanceSheet.updateMany({
      where: { id: sheet.id, status: { in: ['pending', 'disputed'] } },
      data:
        dto.action === 'confirm'
          ? { status: 'confirmed', respondedAt: new Date() }
          : {
              status: 'disputed',
              respondedAt: new Date(),
              note,
              disputedDays: days.map((d) => ({
                date: d.date,
                expected: d.expected ?? null,
              })),
            },
    });
    if (!updated.count) {
      throw new BadRequestException('Bạn đã đồng ý bảng công tháng này');
    }
    if (dto.action === 'dispute') {
      const me = await this.prisma.account.findUnique({
        where: { id: user.id },
        select: { fullName: true },
      });
      await this.notify(
        [sheet.sentById],
        `${me?.fullName ?? 'Nhân viên'} báo sai ${days.length} ngày trong bảng công tháng ${month}/${year}${note ? `: ${note}` : ''}`,
        user,
        { year, month, link: SHEET_LINK_MANAGE },
      );
    }
    return { ok: true };
  }

  // ============================================================ thông báo
  /** Thông báo chuông; lỗi gửi không làm hỏng thao tác chính. Bỏ qua chính người thao tác. */
  private async notify(
    accountIds: string[],
    content: string,
    sender: AuthenticatedUser,
    meta: { year: number; month: number; link: string },
  ): Promise<void> {
    const ids = [...new Set(accountIds.filter((x) => x && x !== sender.id))];
    if (!ids.length) return;
    try {
      const now = new Date();
      for (const accountId of ids) {
        const notification = await this.prisma.notification.create({
          data: {
            accountId,
            type: 'attendance_sheet',
            channel: 'in_app',
            content: content.slice(0, 500),
            senderId: sender.id,
            scheduledAt: now,
            sentAt: now,
            status: 'sent',
            meta,
          },
          include: {
            sender: {
              select: { id: true, fullName: true, role: true, avatarUrl: true },
            },
          },
        });
        this.realtime.emitNotificationCreated(
          toNotificationResponse(notification),
          sender,
        );
      }
    } catch (error) {
      this.logger.error('Gửi thông báo bảng công thất bại', error as Error);
    }
  }
}

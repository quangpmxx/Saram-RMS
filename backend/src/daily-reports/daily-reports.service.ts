import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ReportPenaltyService } from '../report-penalty/report-penalty.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { ListDailyReportQueryDto } from './dto/list-daily-report-query.dto';
import { UpsertDailyReportDto } from './dto/upsert-daily-report.dto';
import {
  DailyReportRowDto,
  DailyReportSummaryDto,
  DailyReportTeamSummaryDto,
  emptyTotals,
  NamedRefWithRole,
} from './dto/daily-report-response.dto';

/** Vai trò được phép xem module Báo cáo hằng ngày — yêu cầu trực tiếp người dùng (Mục 3), MKT không có trong danh sách. */
const ALLOWED_ROLES = new Set(['admin', 'manager', 'leader', 'sale']);

/** Múi giờ hệ thống — giống hệt hằng số đã dùng ở sale-reminder.service.ts, không phát minh quy ước mới. */
const TIMEZONE = 'Asia/Ho_Chi_Minh';

const ACCOUNT_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  teamId: true,
  team: { select: { id: true, name: true } },
} satisfies Prisma.AccountSelect;

const REPORT_INCLUDE = {
  createdBy: { select: { id: true, fullName: true, role: true } },
  updatedBy: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.DailyReportInclude;

type EmployeeWithTeam = Prisma.AccountGetPayload<{
  select: typeof ACCOUNT_SELECT;
}>;
type ReportWithNames = Prisma.DailyReportGetPayload<{
  include: typeof REPORT_INCLUDE;
}>;

/** "YYYY-MM-DD" theo giờ Việt Nam — dùng làm ngày báo cáo mặc định + kiểm tra "chỉ sửa được trong đúng ngày". */
function toDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** "YYYY-MM-DD" -> Date UTC-midnight — khớp cách ShuttleRecord.date được lưu (cột @db.Date, parse thẳng chuỗi ngày). */
function dateOnlyToUtcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/** Khoảng UTC [gte, lt) khớp đúng 1 ngày dương lịch theo giờ Việt Nam — dùng đếm "Data mới" (Lead.uploadedAt) đúng ngày báo cáo. */
function vnDayRange(dateOnly: string): { gte: Date; lt: Date } {
  const start = new Date(`${dateOnly}T00:00:00.000+07:00`);
  return { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function addDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** Liệt kê toàn bộ ngày trong [from, to] (bao gồm cả 2 đầu) — chặn tối đa 366 ngày, tránh lọc sai/quá rộng làm treo truy vấn. */
function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 366) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

function toNamedRef(account: {
  id: string;
  fullName: string;
  role: string;
}): NamedRefWithRole {
  return { id: account.id, name: account.fullName, role: account.role };
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module hoàn toàn mới, yêu cầu trực tiếp người dùng): Báo cáo
 * hằng ngày theo nhóm/nhân viên — thay thế nội dung trang "Báo cáo" cũ
 * (phễu/theo nguồn — engine của Dashboard, KHÔNG bị đụng tới, xem
 * dashboard.service.ts/report.controller.ts vẫn giữ nguyên).
 */
@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly reportPenaltyService: ReportPenaltyService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Danh sách "dòng báo cáo" — 1 dòng / (nhân viên, ngày) trong phạm vi lọc,
   * kể cả khi CHƯA có báo cáo (report_id=null, status='not_reported') — để
   * hiện đúng ai đã/chưa nộp cho từng ngày (Mục 7, yêu cầu người dùng).
   */
  async list(
    query: ListDailyReportQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<DailyReportRowDto[]> {
    const { employees, dates } = await this.resolveEmployeesAndDates(
      query,
      currentUser,
    );
    if (employees.length === 0 || dates.length === 0) return [];
    return this.buildRows(employees, dates);
  }

  /** Mục 5/6, yêu cầu người dùng: KPI tổng + tổng hợp theo nhóm cho đúng phạm vi lọc hiện tại. */
  async summary(
    query: ListDailyReportQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<DailyReportSummaryDto> {
    const { employees, dates } = await this.resolveEmployeesAndDates(
      query,
      currentUser,
    );
    if (employees.length === 0 || dates.length === 0) {
      return { totals: emptyTotals(), by_team: [] };
    }
    const rows = await this.buildRows(employees, dates);

    const totals = emptyTotals();
    const byTeam = new Map<
      string,
      DailyReportTeamSummaryDto & { reportedAccountIds: Set<string> }
    >();

    for (const row of rows) {
      totals.calls += row.calls;
      totals.old_data += row.old_data;
      totals.no_answer += row.no_answer;
      totals.interested += row.interested;
      totals.interview_scheduled += row.interview_scheduled;
      totals.interview_passed += row.interview_passed;
      totals.employed += row.employed;
      totals.new_leads += row.new_leads;

      const teamKey = row.team?.id ?? '__none__';
      if (!byTeam.has(teamKey)) {
        byTeam.set(teamKey, {
          team_id: row.team?.id ?? '',
          team_name: row.team?.name ?? 'Chưa có nhóm',
          reported_count: 0,
          not_reported_count: 0,
          reportedAccountIds: new Set(),
          ...emptyTotals(),
        });
      }
      const bucket = byTeam.get(teamKey)!;
      bucket.calls += row.calls;
      bucket.old_data += row.old_data;
      bucket.no_answer += row.no_answer;
      bucket.interested += row.interested;
      bucket.interview_scheduled += row.interview_scheduled;
      bucket.interview_passed += row.interview_passed;
      bucket.employed += row.employed;
      bucket.new_leads += row.new_leads;
      if (row.status === 'reported')
        bucket.reportedAccountIds.add(row.account.id);
    }

    // "Đã nộp/chưa nộp" tính theo SỐ NHÂN VIÊN có ít nhất 1 báo cáo trong
    // khoảng đã lọc (không nhân theo số ngày) — hợp lý cho cả khi xem đúng
    // 1 ngày (mặc định) lẫn khi mở rộng khoảng ngày.
    const employeesByTeam = new Map<string, number>();
    for (const employee of employees) {
      const key = employee.teamId ?? '__none__';
      employeesByTeam.set(key, (employeesByTeam.get(key) ?? 0) + 1);
    }

    const byTeamResult: DailyReportTeamSummaryDto[] = [...byTeam.entries()].map(
      ([key, bucket]) => {
        const totalMembers = employeesByTeam.get(key) ?? 0;
        const reportedCount = bucket.reportedAccountIds.size;
        return {
          team_id: bucket.team_id,
          team_name: bucket.team_name,
          reported_count: reportedCount,
          not_reported_count: Math.max(0, totalMembers - reportedCount),
          calls: bucket.calls,
          old_data: bucket.old_data,
          no_answer: bucket.no_answer,
          interested: bucket.interested,
          interview_scheduled: bucket.interview_scheduled,
          interview_passed: bucket.interview_passed,
          employed: bucket.employed,
          new_leads: bucket.new_leads,
        };
      },
    );
    byTeamResult.sort((a, b) => a.team_name.localeCompare(b.team_name));

    return { totals, by_team: byTeamResult };
  }

  /** Mục 2, yêu cầu người dùng: chỉ Sale tự tạo báo cáo CHO HÔM NAY của chính mình — chặn trùng ngày. */
  async create(
    dto: UpsertDailyReportDto,
    currentUser: AuthenticatedUser,
  ): Promise<DailyReportRowDto> {
    if (currentUser.role !== 'sale') {
      throw new ForbiddenException(
        'Chỉ Nhân viên/Sale được tạo báo cáo hằng ngày',
      );
    }
    const today = toDateOnly(new Date());
    const existing = await this.prisma.dailyReport.findUnique({
      where: {
        accountId_date: {
          accountId: currentUser.id,
          date: dateOnlyToUtcMidnight(today),
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Bạn đã có báo cáo cho hôm nay — vui lòng sửa thay vì tạo mới',
      );
    }

    const account = await this.prisma.account.findUnique({
      where: { id: currentUser.id },
      select: ACCOUNT_SELECT,
    });

    const report = await this.prisma.dailyReport.create({
      data: {
        date: dateOnlyToUtcMidnight(today),
        accountId: currentUser.id,
        teamId: account?.teamId ?? null,
        calls: dto.calls,
        oldData: dto.old_data,
        noAnswer: dto.no_answer,
        interested: dto.interested,
        interviewScheduled: dto.interview_scheduled,
        interviewPassed: dto.interview_passed,
        employed: dto.employed,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
      include: REPORT_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'daily_report',
      entityId: report.id,
      newValue: `Gọi=${dto.calls}, Data cũ=${dto.old_data}, Không nghe=${dto.no_answer}, Quan tâm=${dto.interested}, Hẹn PV=${dto.interview_scheduled}, Đỗ PV=${dto.interview_passed}, Đi làm=${dto.employed}`,
    });

    // "Check phạt" (Mục 4, yêu cầu người dùng): nếu ngày này từng bị ghi
    // nhận "Không nộp báo cáo" (job Check phạt chạy trước khi Sale kịp
    // nộp trong cùng ngày), tự chuyển vi phạm đó thành "Đã nộp bổ sung" —
    // KHÔNG xóa lịch sử vi phạm, KHÔNG đổi cách nhập báo cáo ở trên.
    await this.reportPenaltyService.markSupplementedIfPending(
      currentUser,
      today,
      report.createdAt,
    );

    const newLeads = await this.countNewLeadsForOne(currentUser.id, today);
    const row = this.toRow(report, account, newLeads);
    this.realtime.emitDailyReportChange('created', row, currentUser);
    return row;
  }

  /** Mục 2, yêu cầu người dùng: chỉ chủ báo cáo được sửa, CHỈ trong đúng ngày báo cáo đó. */
  async update(
    id: string,
    dto: UpsertDailyReportDto,
    currentUser: AuthenticatedUser,
  ): Promise<DailyReportRowDto> {
    const existing = await this.prisma.dailyReport.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy báo cáo hằng ngày');
    }
    if (existing.accountId !== currentUser.id) {
      throw new ForbiddenException(
        'Bạn chỉ được sửa báo cáo hằng ngày của chính mình',
      );
    }
    const today = toDateOnly(new Date());
    const reportDate = toDateOnly(existing.date);
    if (reportDate !== today) {
      throw new ForbiddenException(
        'Chỉ được sửa báo cáo trong đúng ngày báo cáo đó',
      );
    }

    const updated = await this.prisma.dailyReport.update({
      where: { id },
      data: {
        calls: dto.calls,
        oldData: dto.old_data,
        noAnswer: dto.no_answer,
        interested: dto.interested,
        interviewScheduled: dto.interview_scheduled,
        interviewPassed: dto.interview_passed,
        employed: dto.employed,
        updatedById: currentUser.id,
      },
      include: REPORT_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'daily_report',
      entityId: id,
      newValue: `Gọi=${dto.calls}, Data cũ=${dto.old_data}, Không nghe=${dto.no_answer}, Quan tâm=${dto.interested}, Hẹn PV=${dto.interview_scheduled}, Đỗ PV=${dto.interview_passed}, Đi làm=${dto.employed}`,
    });

    const account = await this.prisma.account.findUnique({
      where: { id: currentUser.id },
      select: ACCOUNT_SELECT,
    });
    const newLeads = await this.countNewLeadsForOne(currentUser.id, reportDate);
    const row = this.toRow(updated, account, newLeads);
    this.realtime.emitDailyReportChange('updated', row, currentUser);
    return row;
  }

  /**
   * Phạm vi xem (Mục 3, yêu cầu người dùng): Sale chỉ chính mình; Leader chỉ
   * nhóm mình (account_id lọc thêm được TRONG nhóm); Admin/Quản lý toàn bộ,
   * lọc được theo team_id/account_id. MKT không được xem module này.
   */
  private async resolveEmployeesAndDates(
    query: ListDailyReportQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ employees: EmployeeWithTeam[]; dates: string[] }> {
    if (!ALLOWED_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền xem báo cáo hằng ngày');
    }

    let employeeWhere: Prisma.AccountWhereInput;
    if (currentUser.role === 'sale') {
      employeeWhere = { id: currentUser.id, role: 'sale' };
    } else if (currentUser.role === 'leader') {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      employeeWhere = {
        role: 'sale',
        teamId: account?.teamId ?? '__none__',
        ...(query.account_id ? { id: query.account_id } : {}),
      };
    } else {
      // admin/manager
      employeeWhere = {
        role: 'sale',
        ...(query.team_id ? { teamId: query.team_id } : {}),
        ...(query.account_id ? { id: query.account_id } : {}),
      };
    }

    const employees = await this.prisma.account.findMany({
      where: employeeWhere,
      select: ACCOUNT_SELECT,
      orderBy: { fullName: 'asc' },
    });

    const today = toDateOnly(new Date());
    const dateFrom = query.date_from ? query.date_from.slice(0, 10) : today;
    const dateTo = query.date_to ? query.date_to.slice(0, 10) : today;
    const dates = enumerateDates(
      dateFrom <= dateTo ? dateFrom : dateTo,
      dateFrom <= dateTo ? dateTo : dateFrom,
    );

    return { employees, dates };
  }

  private async buildRows(
    employees: EmployeeWithTeam[],
    dates: string[],
  ): Promise<DailyReportRowDto[]> {
    const employeeIds = employees.map((e) => e.id);

    const [reports, newLeadsPerDate] = await Promise.all([
      this.prisma.dailyReport.findMany({
        where: {
          accountId: { in: employeeIds },
          date: {
            gte: dateOnlyToUtcMidnight(dates[0]),
            lte: dateOnlyToUtcMidnight(dates[dates.length - 1]),
          },
        },
        include: REPORT_INCLUDE,
      }),
      Promise.all(
        dates.map((date) => this.countNewLeadsByEmployee(employeeIds, date)),
      ),
    ]);

    const reportByKey = new Map<string, ReportWithNames>();
    for (const report of reports) {
      reportByKey.set(`${report.accountId}_${toDateOnly(report.date)}`, report);
    }
    const newLeadsByDate = new Map(
      dates.map((date, i) => [date, newLeadsPerDate[i]]),
    );

    const rows: DailyReportRowDto[] = [];
    for (const date of dates) {
      const newLeadsMap = newLeadsByDate.get(date)!;
      for (const employee of employees) {
        const report = reportByKey.get(`${employee.id}_${date}`);
        rows.push({
          date,
          account: {
            id: employee.id,
            name: employee.fullName,
            avatar_url: employee.avatarUrl,
            role: employee.role,
          },
          team: employee.team
            ? { id: employee.team.id, name: employee.team.name }
            : null,
          report_id: report?.id ?? null,
          calls: report?.calls ?? 0,
          old_data: report?.oldData ?? 0,
          no_answer: report?.noAnswer ?? 0,
          interested: report?.interested ?? 0,
          interview_scheduled: report?.interviewScheduled ?? 0,
          interview_passed: report?.interviewPassed ?? 0,
          employed: report?.employed ?? 0,
          new_leads: newLeadsMap.get(employee.id) ?? 0,
          status: report ? 'reported' : 'not_reported',
          created_at: report?.createdAt.toISOString() ?? null,
          updated_at: report?.updatedAt.toISOString() ?? null,
          created_by: report ? toNamedRef(report.createdBy) : null,
          updated_by: report ? toNamedRef(report.updatedBy) : null,
        });
      }
    }

    rows.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.account.name.localeCompare(b.account.name),
    );
    return rows;
  }

  private async countNewLeadsByEmployee(
    accountIds: string[],
    dateOnly: string,
  ): Promise<Map<string, number>> {
    const { gte, lt } = vnDayRange(dateOnly);
    const grouped = await this.prisma.lead.groupBy({
      by: ['assignedToId'],
      where: {
        assignedToId: { in: accountIds },
        uploadedAt: { gte, lt },
        deletedAt: null,
      },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const row of grouped) {
      if (row.assignedToId) map.set(row.assignedToId, row._count._all);
    }
    return map;
  }

  private async countNewLeadsForOne(
    accountId: string,
    dateOnly: string,
  ): Promise<number> {
    const { gte, lt } = vnDayRange(dateOnly);
    return this.prisma.lead.count({
      where: {
        assignedToId: accountId,
        uploadedAt: { gte, lt },
        deletedAt: null,
      },
    });
  }

  private toRow(
    report: ReportWithNames,
    account: EmployeeWithTeam | null,
    newLeads: number,
  ): DailyReportRowDto {
    return {
      date: toDateOnly(report.date),
      account: {
        id: report.accountId,
        name: account?.fullName ?? '',
        avatar_url: account?.avatarUrl ?? null,
        role: account?.role ?? 'sale',
      },
      team:
        report.teamId && account?.team
          ? { id: account.team.id, name: account.team.name }
          : null,
      report_id: report.id,
      calls: report.calls,
      old_data: report.oldData,
      no_answer: report.noAnswer,
      interested: report.interested,
      interview_scheduled: report.interviewScheduled,
      interview_passed: report.interviewPassed,
      employed: report.employed,
      new_leads: newLeads,
      status: 'reported',
      created_at: report.createdAt.toISOString(),
      updated_at: report.updatedAt.toISOString(),
      created_by: toNamedRef(report.createdBy),
      updated_by: toNamedRef(report.updatedBy),
    };
  }
}

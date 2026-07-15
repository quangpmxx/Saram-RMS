import { ForbiddenException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AccountRole, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { BulkSaveAttendanceDto } from './dto/bulk-save-attendance.dto';
import {
  AttendanceDayDto,
  AttendanceGridDto,
  AttendanceStatusValue,
} from './dto/attendance-response.dto';

/**
 * Vai trò xuất hiện dưới dạng 1 DÒNG trong bảng chấm công — khớp đúng danh
 * sách vai trò đã thấy nút "Chấm công" ở header (layout.tsx: mọi vai trò TRỪ
 * Admin/Quản lý), vì Admin/Quản lý là người quản lý bảng chứ không tự chấm
 * công cho chính mình. Đây là 1 giả định hợp lý dựa trên quyết định trước đó
 * trong hệ thống — CHƯA có tài liệu nghiệp vụ nào xác nhận, xem ghi chú cuối
 * PR/commit liên quan module này.
 */
const EMPLOYEE_ROLES: AccountRole[] = ['leader', 'mkt', 'sale'];

/** Mục 8, yêu cầu người dùng: Admin/Quản lý/Leader/Nhân viên đều xem được (phạm vi khác nhau). */
const VIEW_ROLES = new Set(['admin', 'manager', 'leader', 'mkt', 'sale']);

/** Mục 8, yêu cầu người dùng: chỉ Admin/Quản lý/Leader được chỉnh — Nhân viên chỉ xem. */
const EDIT_ROLES = new Set(['admin', 'manager', 'leader']);

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Khớp đúng ACCOUNT_ROLE_LABEL ở frontend (lib/types.ts) — dùng cho cột "Vị trí" khi xuất Excel. */
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Quản lý',
  leader: 'Leader',
  mkt: 'MKT',
  sale: 'Sale',
};

/** Khớp đúng STATUS_META ở frontend (attendance-client.tsx) — ký hiệu + màu nền/chữ khi xuất Excel. */
const STATUS_META: Record<
  AttendanceStatusValue,
  { symbol: string; bg: string; color: string }
> = {
  present: { symbol: '✓', bg: 'FFD1FAE5', color: 'FF047857' },
  half: { symbol: '½', bg: 'FFFEF3C7', color: 'FFB45309' },
  paid_leave: { symbol: 'NP', bg: 'FFE0F2FE', color: 'FF0369A1' },
  unpaid_leave: { symbol: 'N', bg: 'FFFEE2E2', color: 'FFB91C1C' },
  holiday: { symbol: 'L', bg: 'FFF3E8FF', color: 'FF7E22CE' },
  compensatory_leave: { symbol: 'B', bg: 'FFE0E7FF', color: 'FF4338CA' },
};

/** Khớp đúng WORK_UNITS ở frontend — Có công=1, Nửa công=0,5, các trạng thái nghỉ=0. */
const WORK_UNITS: Record<AttendanceStatusValue, number> = {
  present: 1,
  half: 0.5,
  paid_leave: 0,
  unpaid_leave: 0,
  holiday: 0,
  compensatory_leave: 0,
};

const HEADER_FILL = 'FFEFF6FF';
const SUNDAY_HEADER_FILL = 'FFFEE2E2';
const SUNDAY_EMPTY_FILL = 'FFFEF2F2';

const ACCOUNT_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  position: true,
  teamId: true,
  status: true,
  team: { select: { id: true, name: true } },
  // Dự án phụ — nâng cấp toàn diện (2026-07-15, yêu cầu trực tiếp người
  // dùng): nối 5 field hồ sơ nhân sự (đã thêm ở accounts module) sang modal
  // "Thông tin nhân viên" của Chấm công — chỉ ĐỌC ở đây, sửa vẫn qua trang
  // Quản lý tài khoản (PUT /account/:id), không tạo endpoint sửa riêng.
  dateOfBirth: true,
  hireDate: true,
  personalPhone: true,
  personalEmail: true,
  remainingLeaveDays: true,
  // Bổ sung 2026-07-15 (yêu cầu trực tiếp người dùng): nối CCCD + STK sang
  // modal "Thông tin nhân viên" — cùng quy tắc chỉ ĐỌC như 5 field trên.
  citizenId: true,
  bankAccountNumber: true,
} satisfies Prisma.AccountSelect;

/** "YYYY-MM-DD" -> Date UTC-midnight — khớp cách ShuttleRecord/DailyReport.date được lưu (cột @db.Date). */
function dateOnlyToUtcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Số ngày thực tế của tháng (28/29/30/31) — Mục 1/10, yêu cầu người dùng. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildDays(year: number, month: number): AttendanceDayDto[] {
  const total = daysInMonth(year, month);
  const days: AttendanceDayDto[] = [];
  for (let day = 1; day <= total; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    days.push({
      date: `${year}-${pad2(month)}-${pad2(day)}`,
      day,
      weekday_label: WEEKDAY_LABELS[weekday],
      is_sunday: weekday === 0,
    });
  }
  return days;
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module hoàn toàn mới, yêu cầu trực tiếp người dùng): Chấm
 * công thủ công theo tháng — thay thao tác gõ số "1" bằng click/tick.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getGrid(
    query: ListAttendanceQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceGridDto> {
    const { employees, days, records } = await this.fetchGridData(
      query,
      currentUser,
    );

    return {
      year: query.year,
      month: query.month,
      days,
      employees: employees.map((e) => ({
        account_id: e.id,
        full_name: e.fullName,
        avatar_url: e.avatarUrl,
        role: e.role,
        position: e.position,
        team_id: e.teamId,
        team_name: e.team?.name ?? null,
        status: e.status,
        date_of_birth: e.dateOfBirth ? toDateOnly(e.dateOfBirth) : null,
        hire_date: e.hireDate ? toDateOnly(e.hireDate) : null,
        personal_phone: e.personalPhone,
        personal_email: e.personalEmail,
        remaining_leave_days: e.remainingLeaveDays,
        citizen_id: e.citizenId,
        bank_account_number: e.bankAccountNumber,
      })),
      records: records.map((r) => ({
        account_id: r.accountId,
        date: toDateOnly(r.date),
        status: r.status,
        note: r.note,
        updated_at: r.updatedAt.toISOString(),
      })),
      can_edit: EDIT_ROLES.has(currentUser.role),
    };
  }

  /**
   * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
   * docs/09-13, yêu cầu trực tiếp người dùng): "tải xuống Excel cho bảng
   * chấm công" — xuất ĐÚNG phạm vi đang xem (cùng RBAC/bộ lọc với
   * getGrid()), không phát minh quyền/phạm vi riêng cho export. Bố cục
   * khớp giao diện: 2 hàng tiêu đề (số ngày + thứ, gộp ô dọc cho
   * STT/Họ và tên/Vị trí/Tổng công), ký hiệu + màu từng trạng thái khớp
   * đúng STATUS_META ở attendance-client.tsx, Chủ nhật tô nền hồng nhạt,
   * ghim cứng 3 cột đầu + 2 hàng tiêu đề (freeze panes) như trên giao diện.
   */
  async exportXlsx(
    query: ListAttendanceQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { employees, days, records } = await this.fetchGridData(
      query,
      currentUser,
    );

    const recordByKey = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      recordByKey.set(`${record.accountId}_${toDateOnly(record.date)}`, record);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(
      `Thang ${query.month}-${query.year}`.slice(0, 31),
    );

    const totalColumnIndex = 3 + days.length + 1;

    sheet.addRow([
      'STT',
      'Họ và tên',
      'Vị trí',
      ...days.map((d) => pad2(d.day)),
      'Tổng công',
    ]);
    sheet.addRow(['', '', '', ...days.map((d) => d.weekday_label), '']);

    sheet.mergeCells(1, 1, 2, 1);
    sheet.mergeCells(1, 2, 2, 2);
    sheet.mergeCells(1, 3, 2, 3);
    sheet.mergeCells(1, totalColumnIndex, 2, totalColumnIndex);

    for (const rowNumber of [1, 2]) {
      const row = sheet.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      for (const col of [1, 2, 3, totalColumnIndex]) {
        sheet.getCell(rowNumber, col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: HEADER_FILL },
        };
      }
      days.forEach((day, i) => {
        sheet.getCell(rowNumber, 4 + i).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: day.is_sunday ? SUNDAY_HEADER_FILL : HEADER_FILL },
        };
      });
    }

    employees.forEach((employee, index) => {
      let total = 0;
      const rowValues: (string | number)[] = [
        index + 1,
        employee.fullName,
        employee.position ?? ROLE_LABEL[employee.role] ?? employee.role,
      ];
      for (const day of days) {
        const record = recordByKey.get(`${employee.id}_${day.date}`);
        if (record) {
          rowValues.push(STATUS_META[record.status].symbol);
          total += WORK_UNITS[record.status];
        } else {
          rowValues.push('');
        }
      }
      rowValues.push(total);

      const row = sheet.addRow(rowValues);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(totalColumnIndex).alignment = { horizontal: 'center' };
      row.getCell(totalColumnIndex).font = { bold: true };

      days.forEach((day, i) => {
        const cell = row.getCell(4 + i);
        cell.alignment = { horizontal: 'center' };
        const record = recordByKey.get(`${employee.id}_${day.date}`);
        if (record) {
          const meta = STATUS_META[record.status];
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: meta.bg },
          };
          cell.font = { bold: true, color: { argb: meta.color } };
        } else if (day.is_sunday) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: SUNDAY_EMPTY_FILL },
          };
        }
      });
    });

    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 12;
    days.forEach((_, i) => {
      sheet.getColumn(4 + i).width = 5;
    });
    sheet.getColumn(totalColumnIndex).width = 10;

    // Ghim cứng 3 cột đầu + 2 hàng tiêu đề — khớp hành vi "ghim cố định
    // thanh tiêu đề" đã làm ở giao diện (yêu cầu trực tiếp người dùng).
    sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 2 }];

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `cham-cong-thang-${query.month}-${query.year}.xlsx`;
    return { buffer, filename };
  }

  /**
   * Mục 1/7, yêu cầu người dùng: "Lưu thay đổi" gửi 1 lần toàn bộ ô đã sửa
   * cục bộ (không lưu ngay theo từng click).
   *
   * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
   * docs/09-13, yêu cầu trực tiếp người dùng): "tick NP thì trừ 1 ngày phép,
   * hết phép thì không tick được NP nữa". Tính NET số ngày NP thay đổi cho
   * MỖI nhân viên trong cả lô (VD: đổi 1 ô từ NP sang trạng thái khác =
   * hoàn 1 ngày; xóa 1 ô đang là NP = hoàn 1 ngày; đặt 1 ô mới thành NP =
   * trừ 1 ngày) — rồi chặn TOÀN BỘ lô (không lưu ô nào) nếu bất kỳ nhân
   * viên nào không đủ số dư, để tránh lưu nửa vời khó hiểu. `null` (chưa
   * được Admin đặt số ban đầu) coi như 0 — không cho tick NP khi chưa có
   * phép nào được cấp.
   */
  async bulkSave(
    dto: BulkSaveAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ saved: number; deleted: number }> {
    if (!EDIT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền chấm công');
    }

    const referencedIds = new Set<string>();
    for (const cell of dto.upserts) referencedIds.add(cell.account_id);
    for (const cell of dto.deletes) referencedIds.add(cell.account_id);
    if (referencedIds.size > 0) {
      await this.assertEmployeesInScope([...referencedIds], currentUser);
    }

    const npBalanceUpdates = await this.checkAndComputeNpBalanceChanges(dto);

    // Mỗi ô ứng với 1 khóa duy nhất (account_id, date) độc lập với các ô
    // khác — không cần bọc chung 1 $transaction nguyên tử cho cả lô, chạy
    // song song bằng Promise.all cho đơn giản và đúng kiểu dữ liệu.
    const upserted = await Promise.all(
      dto.upserts.map((cell) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            accountId_date: {
              accountId: cell.account_id,
              date: dateOnlyToUtcMidnight(cell.date),
            },
          },
          create: {
            accountId: cell.account_id,
            date: dateOnlyToUtcMidnight(cell.date),
            status: cell.status,
            note: cell.note ?? null,
            createdById: currentUser.id,
            updatedById: currentUser.id,
          },
          update: {
            status: cell.status,
            note: cell.note ?? null,
            updatedById: currentUser.id,
          },
        }),
      ),
    );
    await Promise.all(
      dto.deletes.map((cell) =>
        this.prisma.attendanceRecord.deleteMany({
          where: {
            accountId: cell.account_id,
            date: dateOnlyToUtcMidnight(cell.date),
          },
        }),
      ),
    );

    // Cập nhật số phép còn lại SAU khi ghi bảng chấm công thành công — chỉ
    // những nhân viên có ô NP thay đổi mới có trong danh sách này (delta=0
    // đã bị lọc sẵn ở checkAndComputeNpBalanceChanges()).
    await Promise.all(
      npBalanceUpdates.map((update) =>
        this.prisma.account.update({
          where: { id: update.accountId },
          data: { remainingLeaveDays: update.newBalance },
        }),
      ),
    );

    // Ghi audit log SAU khi transaction đã commit (Mục 7, yêu cầu người
    // dùng: ghi log khi thêm/sửa/xóa) — không chặn phản hồi nếu log lỗi
    // (AuditLogService.log() tự nuốt lỗi, xem audit-log.service.ts).
    await Promise.all([
      ...upserted.map((record) =>
        this.auditLog.log({
          accountId: currentUser.id,
          actionType: 'update',
          entityType: 'attendance_record',
          entityId: record.id,
          newValue: `Trạng thái=${record.status}${record.note ? `, Ghi chú=${record.note}` : ''}`,
        }),
      ),
      ...dto.deletes.map((cell) =>
        this.auditLog.log({
          accountId: currentUser.id,
          actionType: 'delete',
          entityType: 'attendance_record',
          oldValue: `account_id=${cell.account_id}, date=${cell.date}`,
        }),
      ),
      ...npBalanceUpdates.map((update) =>
        this.auditLog.log({
          accountId: currentUser.id,
          actionType: 'update',
          entityType: 'account',
          entityId: update.accountId,
          fieldChanged: 'remaining_leave_days',
          oldValue: String(update.oldBalance),
          newValue: String(update.newBalance),
        }),
      ),
    ]);

    return { saved: upserted.length, deleted: dto.deletes.length };
  }

  /**
   * Tính NET số ngày NP thay đổi cho từng nhân viên trong cả lô, chặn TOÀN
   * BỘ lô bằng ForbiddenException nếu bất kỳ ai không đủ số dư — KHÔNG ghi
   * gì xuống DB ở hàm này (chỉ tính toán + kiểm tra), việc ghi thật nằm ở
   * bulkSave() sau khi hàm này xác nhận hợp lệ.
   */
  private async checkAndComputeNpBalanceChanges(
    dto: BulkSaveAttendanceDto,
  ): Promise<
    Array<{ accountId: string; oldBalance: number; newBalance: number }>
  > {
    const cells = [
      ...dto.upserts.map((c) => ({ account_id: c.account_id, date: c.date })),
      ...dto.deletes,
    ];
    if (cells.length === 0) return [];

    const accountIds = [...new Set(cells.map((c) => c.account_id))];
    const existing = await this.prisma.attendanceRecord.findMany({
      where: { accountId: { in: accountIds } },
      select: { accountId: true, date: true, status: true },
    });
    const existingStatusByKey = new Map<string, AttendanceStatusValue>();
    for (const record of existing) {
      existingStatusByKey.set(
        `${record.accountId}_${toDateOnly(record.date)}`,
        record.status,
      );
    }

    const npDeltaByAccount = new Map<string, number>();
    const addDelta = (accountId: string, delta: number) => {
      if (delta === 0) return;
      npDeltaByAccount.set(
        accountId,
        (npDeltaByAccount.get(accountId) ?? 0) + delta,
      );
    };

    for (const cell of dto.upserts) {
      const wasNp =
        existingStatusByKey.get(`${cell.account_id}_${cell.date}`) ===
        'paid_leave';
      const willBeNp = cell.status === 'paid_leave';
      addDelta(cell.account_id, (willBeNp ? 1 : 0) - (wasNp ? 1 : 0));
    }
    for (const cell of dto.deletes) {
      const wasNp =
        existingStatusByKey.get(`${cell.account_id}_${cell.date}`) ===
        'paid_leave';
      if (wasNp) addDelta(cell.account_id, -1);
    }

    if (npDeltaByAccount.size === 0) return [];

    const accounts = await this.prisma.account.findMany({
      where: { id: { in: [...npDeltaByAccount.keys()] } },
      select: { id: true, fullName: true, remainingLeaveDays: true },
    });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const updates: Array<{
      accountId: string;
      oldBalance: number;
      newBalance: number;
    }> = [];
    for (const [accountId, delta] of npDeltaByAccount) {
      const account = accountById.get(accountId);
      const oldBalance = account?.remainingLeaveDays ?? 0;
      const newBalance = oldBalance - delta;
      if (newBalance < 0) {
        throw new ForbiddenException(
          `${account?.fullName ?? accountId} không đủ ngày phép còn lại (còn ${oldBalance}, cần ${delta}) — không thể chấm thêm Nghỉ phép (NP)`,
        );
      }
      updates.push({ accountId, oldBalance, newBalance });
    }
    return updates;
  }

  /**
   * Dùng chung cho getGrid() và exportXlsx() — cùng 1 phạm vi RBAC/bộ lọc
   * (Mục 3, yêu cầu người dùng), tránh export có phạm vi khác màn hình đang
   * xem.
   */
  private async fetchGridData(
    query: ListAttendanceQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    if (!VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền xem chấm công');
    }

    const employeeWhere = await this.resolveEmployeeWhere(query, currentUser);
    const employees = await this.prisma.account.findMany({
      where: employeeWhere,
      select: ACCOUNT_SELECT,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });

    const days = buildDays(query.year, query.month);
    const employeeIds = employees.map((e) => e.id);

    const records =
      employeeIds.length === 0
        ? []
        : await this.prisma.attendanceRecord.findMany({
            where: {
              accountId: { in: employeeIds },
              date: {
                gte: dateOnlyToUtcMidnight(days[0].date),
                lte: dateOnlyToUtcMidnight(days[days.length - 1].date),
              },
            },
          });

    return { employees, days, records };
  }

  /** Mục 3, yêu cầu người dùng: Sale/MKT chỉ xem chính mình; Leader chỉ nhóm mình; Admin/Quản lý toàn bộ. */
  private async resolveEmployeeWhere(
    query: ListAttendanceQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<Prisma.AccountWhereInput> {
    const statusFilter: Prisma.AccountWhereInput = query.include_inactive
      ? {}
      : { status: 'active' };

    if (currentUser.role === 'sale' || currentUser.role === 'mkt') {
      return { id: currentUser.id, role: { in: EMPLOYEE_ROLES } };
    }
    if (currentUser.role === 'leader') {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      return {
        role: { in: EMPLOYEE_ROLES },
        teamId: account?.teamId ?? '__none__',
        ...(query.account_id ? { id: query.account_id } : {}),
        ...statusFilter,
      };
    }
    // admin/manager
    return {
      role: { in: EMPLOYEE_ROLES },
      ...(query.team_id ? { teamId: query.team_id } : {}),
      ...(query.account_id ? { id: query.account_id } : {}),
      ...statusFilter,
    };
  }

  /**
   * Chặn Leader chỉnh công nhân viên ngoài nhóm mình, chặn mọi vai trò
   * KHÔNG thuộc EDIT_ROLES đi vòng qua bulkSave() — "Không cho nhân viên
   * thường sửa công của người khác" (Mục 11, yêu cầu người dùng).
   */
  private async assertEmployeesInScope(
    accountIds: string[],
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    let where: Prisma.AccountWhereInput = {
      id: { in: accountIds },
      role: { in: EMPLOYEE_ROLES },
    };
    if (currentUser.role === 'leader') {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      where = { ...where, teamId: account?.teamId ?? '__none__' };
    }
    const inScope = await this.prisma.account.findMany({
      where,
      select: { id: true },
    });
    if (inScope.length !== accountIds.length) {
      throw new ForbiddenException(
        'Một số nhân viên không thuộc phạm vi chấm công của bạn',
      );
    }
  }

  /**
   * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
   * docs/09-13, yêu cầu trực tiếp người dùng): "cho phép sửa tay tên các vị
   * trí". Dùng đúng EDIT_ROLES + phạm vi nhóm (giống bulkSave) — không phát
   * minh quyền riêng cho việc đổi tên chức vụ. Chuỗi rỗng/khoảng trắng ->
   * lưu `null` (xóa chức vụ tùy chỉnh, quay về nhãn vai trò mặc định).
   */
  async updateEmployeePosition(
    accountId: string,
    position: string | null | undefined,
    currentUser: AuthenticatedUser,
  ): Promise<{ account_id: string; position: string | null }> {
    if (!EDIT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền sửa vị trí');
    }
    await this.assertEmployeesInScope([accountId], currentUser);

    const normalized = position?.trim() ? position.trim() : null;
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { position: normalized },
      select: { id: true, position: true },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'account',
      entityId: accountId,
      fieldChanged: 'position',
      newValue: normalized ?? '(xóa — dùng nhãn vai trò mặc định)',
    });

    return { account_id: updated.id, position: updated.position };
  }
}

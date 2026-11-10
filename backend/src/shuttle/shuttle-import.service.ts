import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook, type Worksheet } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RECRUITER_ROLES } from '../common/utils/sale-roles';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { getCellText } from '../imports/excel-row.util';
import {
  COLUMN_LABEL,
  STATUS_ALIASES,
  type ShuttleColumnKey,
  detectShuttleHeader,
  fold,
  matchAccount,
  parseShuttleDate,
  parseShuttleTime,
  splitNamePhone,
  stripTrailingPhone,
  suggestAccount,
} from './shuttle-import.util';
import {
  SHUTTLE_RESULT_PASSED,
  SHUTTLE_STATUS_ATTENDED,
} from './dto/create-shuttle-option.dto';

export const SHUTTLE_IMPORT_MAX_ROWS = 20000;

/** Cột chọn từ danh sách lựa chọn (shuttle_options) — không khớp lựa chọn nào → để trống. */
const OPTION_COLUMNS = {
  area: 'area',
  type: 'type',
  contractor: 'contractor',
  status: 'status',
  interviewResult: 'interview_result',
  leadSource: 'lead_source',
} as const;
type OptionColumn = keyof typeof OPTION_COLUMNS;

/** Cột phải đối chiếu (danh mục/tài khoản) — báo các giá trị không khớp ở bước xem trước. */
type MatchedColumn = OptionColumn | 'company' | 'sale' | 'interviewTime';

/** Ghép tên NV đưa đón trong sheet → tài khoản (null = để trống), người dùng đã xác nhận. */
export type DriverMapping = Record<string, string | null>;

export interface ParsedRow {
  date: string;
  fullName: string;
  phoneNumber: string;
  companyId: string | null;
  area: string | null;
  type: string | null;
  saleUserId: string | null;
  interviewTime: string | null;
  contractor: string | null;
  status: string | null;
  interviewResult: string | null;
  leadSource: string | null;
  note: string | null;
}

export interface SheetRow {
  data: ParsedRow;
  /** Chữ ở cột NV đưa đón — ghép tài khoản lúc nhập theo bảng người dùng đã xác nhận. */
  driverRaw: string;
}

export interface SheetReport {
  name: string;
  header_found: boolean;
  columns: string[];
  rows: number;
  will_create: number;
  bad_date: number;
}

/**
 * Nhập danh sách đưa đón cũ từ Excel (yêu cầu người dùng 2026-11-08) — chỉ Admin. 2 bước, mỗi
 * bước gửi lại file: xem trước (không ghi gì) → nhập. Ô không đối chiếu được → để trống; dòng
 * không đọc được ngày → bỏ qua (báo lại). Dòng trùng VẪN nhập (lao động hẹn lại nhiều lần) —
 * Dashboard gộp trùng SĐT + tên khi đếm người. NV đưa đón không khớp chính xác → gợi ý tên giống
 * nhất, người dùng xác nhận ở bước xem trước.
 */
@Injectable()
export class ShuttleImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async preview(buffer: Buffer) {
    return this.report(await this.parse(buffer, null));
  }

  /** Kết quả đọc sheet → bảng xem trước gửi cho giao diện. */
  report({
    sheets,
    unmatched,
    badDates,
    drivers,
    driverAccounts,
  }: Awaited<ReturnType<ShuttleImportService['parseSheets']>>) {
    return {
      sheets: sheets.map((s) => s.report),
      unmatched: Object.fromEntries(
        Object.entries(unmatched).map(([key, counts]) => [
          COLUMN_LABEL[key as ShuttleColumnKey],
          [...counts]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([value, count]) => ({ value, count })),
        ]),
      ),
      bad_dates: badDates.slice(0, 20),
      // NV đưa đón: chính xác 100% thì tự gán; còn lại gợi ý tên giống nhất để xác nhận.
      drivers: [...drivers]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => {
          const s = suggestAccount(value, driverAccounts);
          return {
            value,
            count,
            exact: s?.exact ?? false,
            suggested_account_id: s?.id ?? null,
          };
        }),
      driver_accounts: driverAccounts
        .map((a) => ({
          id: a.id,
          name: a.nickname ? `${a.fullName} (${a.nickname})` : a.fullName,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    };
  }

  async commit(
    buffer: Buffer,
    sheetNames: string[],
    driverMapping: DriverMapping,
    user: AuthenticatedUser,
  ) {
    if (!sheetNames.length)
      throw new BadRequestException('Chưa chọn sheet nào');
    const { sheets, driverAccounts } = await this.parse(
      buffer,
      new Set(sheetNames),
    );
    const driverIds = new Set(driverAccounts.map((a) => a.id));
    for (const id of Object.values(driverMapping)) {
      if (id && !driverIds.has(id)) {
        throw new BadRequestException('NV đưa đón đã chọn không hợp lệ');
      }
    }
    const resolveDriver = (raw: string): string | null => {
      if (!raw) return null;
      if (Object.prototype.hasOwnProperty.call(driverMapping, raw)) {
        return driverMapping[raw];
      }
      const s = suggestAccount(raw, driverAccounts);
      return s?.exact ? s.id : null;
    };
    const rows = sheets.flatMap((s) => s.rows);
    if (!rows.length) {
      throw new BadRequestException('Không có dòng nào để nhập');
    }
    // Giữ thứ tự sheet: mỗi dòng tạo sau dòng trước 1ms → trong cùng ngày hiện đúng thứ tự như
    // nhập tay lần lượt (bảng xếp dòng tạo sau lên trên).
    const base = Date.now();
    let created = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const r = await this.prisma.shuttleRecord.createMany({
        data: chunk.map(({ data, driverRaw }, j) => ({
          ...data,
          driverUserId: resolveDriver(driverRaw),
          date: new Date(data.date),
          createdAt: new Date(base + i + j),
          createdById: user.id,
          updatedById: user.id,
        })),
      });
      created += r.count;
    }
    await this.auditLog.log({
      accountId: user.id,
      actionType: 'create',
      entityType: 'shuttle_record',
      fieldChanged: 'import_excel',
      newValue: `Nhập Excel ${created} dòng (${sheets.map((s) => s.report.name).join(', ')})`,
    });
    return { created };
  }

  private async parse(buffer: Buffer, onlySheets: Set<string> | null) {
    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('Không đọc được file — cần file .xlsx');
    }
    return this.parseSheets(
      workbook.worksheets
        .filter((ws) => !onlySheets || onlySheets.has(ws.name))
        .map((ws) => ({ name: ws.name, ws })),
    );
  }

  /** Đọc các sheet đã mở (file Excel hoặc tab Google Sheet) → dòng đã đối chiếu + báo cáo. */
  async parseSheets(list: { name: string; ws: Worksheet }[]) {
    const [options, companies, saleAccounts, driverAccounts] =
      await Promise.all([
        this.prisma.shuttleOption.findMany({
          select: { field: true, value: true },
        }),
        this.prisma.orderRecord.findMany({ select: { id: true, name: true } }),
        // Cả tài khoản đã nghỉ — danh sách cũ có thể có Sale/NV đưa đón đã nghỉ việc.
        this.prisma.account.findMany({
          where: { role: { in: RECRUITER_ROLES } },
          select: { id: true, fullName: true, nickname: true },
        }),
        this.prisma.account.findMany({
          where: { role: 'shuttle_staff' },
          select: { id: true, fullName: true, nickname: true },
        }),
      ]);
    const optionMap = new Map<string, string>(
      options.map((o) => [`${o.field}|${fold(o.value)}`, o.value]),
    );
    const companyMap = new Map<string, string | null>();
    for (const c of companies) {
      const k = fold(c.name);
      // Trùng tên 2 đơn → không biết chọn đơn nào → để trống.
      companyMap.set(k, companyMap.has(k) ? null : c.id);
    }

    const unmatched: Partial<Record<MatchedColumn, Map<string, number>>> = {};
    const miss = (key: MatchedColumn, value: string) => {
      const m = (unmatched[key] ??= new Map());
      m.set(value, (m.get(value) ?? 0) + 1);
    };
    const badDates: { sheet: string; row: number; value: string }[] = [];
    const sheets: { report: SheetReport; rows: SheetRow[] }[] = [];
    const drivers = new Map<string, number>();
    let total = 0;

    for (const { name: sheetName, ws } of list) {
      if (ws.rowCount === 0) continue;
      const header = detectShuttleHeader(ws);
      const report: SheetReport = {
        name: sheetName,
        header_found: !!header,
        columns: header
          ? (Object.keys(header.columns) as ShuttleColumnKey[]).map(
              (k) => COLUMN_LABEL[k],
            )
          : [],
        rows: 0,
        will_create: 0,
        bad_date: 0,
      };
      const rows: SheetRow[] = [];
      sheets.push({ report, rows });
      if (!header) continue;
      const col = header.columns;
      const text = (r: number, key: ShuttleColumnKey) =>
        col[key] ? getCellText(ws.getRow(r), col[key]) : '';

      for (let r = header.row + 1; r <= ws.rowCount; r++) {
        const nameCell = text(r, 'fullName');
        const phoneCell = text(r, 'phone');
        const { fullName, phone } = splitNamePhone(nameCell, phoneCell);
        if (!fullName && !phone) continue; // dòng trống
        report.rows++;
        if (++total > SHUTTLE_IMPORT_MAX_ROWS) {
          throw new BadRequestException(
            `File quá ${SHUTTLE_IMPORT_MAX_ROWS} dòng — chia nhỏ file rồi nhập lần lượt`,
          );
        }
        const dateRaw = text(r, 'date');
        const date = parseShuttleDate(dateRaw);
        if (!date) {
          report.bad_date++;
          badDates.push({ sheet: sheetName, row: r, value: dateRaw });
          continue;
        }
        const option = (key: OptionColumn): string | null => {
          const raw = text(r, key);
          if (!raw) return null;
          // "Không đón được" ở sheet = "Chưa đón được" ở phần mềm (2026-11-08).
          const alias =
            key === 'status' ? STATUS_ALIASES[fold(raw)] : undefined;
          const v = optionMap.get(
            `${OPTION_COLUMNS[key]}|${fold(alias ?? raw)}`,
          );
          if (!v) miss(key, raw);
          return v ?? null;
        };
        const saleRaw = text(r, 'sale');
        const saleUserId = saleRaw ? matchAccount(saleRaw, saleAccounts) : null;
        if (saleRaw && !saleUserId) miss('sale', saleRaw);
        const driverRaw = stripTrailingPhone(text(r, 'driver'));
        if (driverRaw)
          drivers.set(driverRaw, (drivers.get(driverRaw) ?? 0) + 1);
        const companyRaw = text(r, 'company');
        const companyId = companyRaw
          ? (companyMap.get(fold(companyRaw)) ?? null)
          : null;
        if (companyRaw && !companyId) miss('company', companyRaw);
        const timeRaw = text(r, 'interviewTime');
        const interviewTime = parseShuttleTime(timeRaw);
        if (timeRaw && !interviewTime) miss('interviewTime', timeRaw);
        const status = option('status');
        // Sheet để trống Kết quả = Đỗ PV (người dùng 2026-11-08) — chỉ khi sheet có cột Kết quả
        // và dòng đó đã đón được người (người không đến thì không thể đỗ).
        const resultRaw = text(r, 'interviewResult');
        const interviewResult = resultRaw
          ? option('interviewResult')
          : col.interviewResult && status === SHUTTLE_STATUS_ATTENDED
            ? SHUTTLE_RESULT_PASSED
            : null;
        const note = text(r, 'note');

        rows.push({
          driverRaw,
          data: {
            date,
            fullName,
            phoneNumber: phone,
            companyId,
            area: option('area'),
            type: option('type'),
            saleUserId,
            interviewTime,
            contractor: option('contractor'),
            status,
            interviewResult,
            leadSource: option('leadSource'),
            note: note || null,
          },
        });
      }
    }

    // Cho phép nhập trùng (2026-11-08) — Dashboard tự gộp trùng SĐT + tên khi đếm người.
    for (const s of sheets) s.report.will_create = s.rows.length;

    return { sheets, unmatched, badDates, drivers, driverAccounts };
  }
}

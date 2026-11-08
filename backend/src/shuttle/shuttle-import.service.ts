import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RECRUITER_ROLES } from '../common/utils/sale-roles';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { getCellText } from '../imports/excel-row.util';
import {
  COLUMN_LABEL,
  type ShuttleColumnKey,
  detectShuttleHeader,
  fold,
  matchAccount,
  parseShuttleDate,
  parseShuttleTime,
  splitNamePhone,
} from './shuttle-import.util';

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
type MatchedColumn =
  OptionColumn | 'company' | 'sale' | 'driver' | 'interviewTime';

export interface ParsedRow {
  date: string;
  fullName: string;
  phoneNumber: string;
  companyId: string | null;
  area: string | null;
  type: string | null;
  saleUserId: string | null;
  driverUserId: string | null;
  interviewTime: string | null;
  contractor: string | null;
  status: string | null;
  interviewResult: string | null;
  leadSource: string | null;
  note: string | null;
}

export interface SheetReport {
  name: string;
  header_found: boolean;
  columns: string[];
  rows: number;
  will_create: number;
  duplicates: number;
  bad_date: number;
}

/**
 * Nhập danh sách đưa đón cũ từ Excel (yêu cầu người dùng 2026-11-08) — chỉ Admin. 2 bước, mỗi
 * bước gửi lại file: xem trước (không ghi gì) → nhập. Ô không đối chiếu được → để trống; dòng
 * không đọc được ngày → bỏ qua (báo lại); dòng đã có (cùng ngày + SĐT) → bỏ qua để nhập lại
 * file không bị nhân đôi.
 */
@Injectable()
export class ShuttleImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async preview(buffer: Buffer) {
    const { sheets, unmatched, badDates } = await this.parse(buffer, null);
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
    };
  }

  async commit(buffer: Buffer, sheetNames: string[], user: AuthenticatedUser) {
    if (!sheetNames.length)
      throw new BadRequestException('Chưa chọn sheet nào');
    const { sheets } = await this.parse(buffer, new Set(sheetNames));
    const rows = sheets.flatMap((s) => s.rows);
    if (!rows.length) {
      throw new BadRequestException('Không có dòng nào để nhập');
    }
    let created = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const r = await this.prisma.shuttleRecord.createMany({
        data: chunk.map((row) => ({
          ...row,
          date: new Date(row.date),
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
    const seen = new Set<string>();
    const sheets: { report: SheetReport; rows: ParsedRow[] }[] = [];
    let total = 0;

    for (const ws of workbook.worksheets) {
      if (ws.rowCount === 0) continue;
      if (onlySheets && !onlySheets.has(ws.name)) continue;
      const header = detectShuttleHeader(ws);
      const report: SheetReport = {
        name: ws.name,
        header_found: !!header,
        columns: header
          ? (Object.keys(header.columns) as ShuttleColumnKey[]).map(
              (k) => COLUMN_LABEL[k],
            )
          : [],
        rows: 0,
        will_create: 0,
        duplicates: 0,
        bad_date: 0,
      };
      const rows: ParsedRow[] = [];
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
          badDates.push({ sheet: ws.name, row: r, value: dateRaw });
          continue;
        }
        const dupKey = `${date}|${phone || fold(fullName)}`;
        if (seen.has(dupKey)) {
          report.duplicates++;
          continue;
        }
        seen.add(dupKey);

        const option = (key: OptionColumn): string | null => {
          const raw = text(r, key);
          if (!raw) return null;
          const v = optionMap.get(`${OPTION_COLUMNS[key]}|${fold(raw)}`);
          if (!v) miss(key, raw);
          return v ?? null;
        };
        const account = (
          key: 'sale' | 'driver',
          list: typeof saleAccounts,
        ): string | null => {
          const raw = text(r, key);
          if (!raw) return null;
          const id = matchAccount(raw, list);
          if (!id) miss(key, raw);
          return id;
        };
        const companyRaw = text(r, 'company');
        const companyId = companyRaw
          ? (companyMap.get(fold(companyRaw)) ?? null)
          : null;
        if (companyRaw && !companyId) miss('company', companyRaw);
        const timeRaw = text(r, 'interviewTime');
        const interviewTime = parseShuttleTime(timeRaw);
        if (timeRaw && !interviewTime) miss('interviewTime', timeRaw);
        const note = text(r, 'note');

        rows.push({
          date,
          fullName,
          phoneNumber: phone,
          companyId,
          area: option('area'),
          type: option('type'),
          saleUserId: account('sale', saleAccounts),
          driverUserId: account('driver', driverAccounts),
          interviewTime,
          contractor: option('contractor'),
          status: option('status'),
          interviewResult: option('interviewResult'),
          leadSource: option('leadSource'),
          note: note || null,
        });
      }
    }

    // Dòng đã có trong phần mềm (cùng ngày + SĐT, chưa xoá) → bỏ qua.
    const all = sheets.flatMap((s) => s.rows);
    const phones = [...new Set(all.map((r) => r.phoneNumber).filter(Boolean))];
    const existing = new Set<string>();
    for (let i = 0; i < phones.length; i += 1000) {
      const found = await this.prisma.shuttleRecord.findMany({
        where: {
          phoneNumber: { in: phones.slice(i, i + 1000) },
          deletedAt: null,
        },
        select: { date: true, phoneNumber: true },
      });
      for (const f of found) {
        existing.add(`${f.date.toISOString().slice(0, 10)}|${f.phoneNumber}`);
      }
    }
    for (const s of sheets) {
      const before = s.rows.length;
      const kept = s.rows.filter(
        (r) => !r.phoneNumber || !existing.has(`${r.date}|${r.phoneNumber}`),
      );
      s.report.duplicates += before - kept.length;
      s.rows.splice(0, s.rows.length, ...kept);
      s.report.will_create = kept.length;
    }

    return { sheets, unmatched, badDates };
  }
}

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { decryptToken, encryptToken } from '../marketing-hub/token-crypto';
import {
  type DriverMapping,
  type ParsedRow,
  type SheetRow,
  ShuttleImportService,
} from './shuttle-import.service';
import { fold, suggestAccount } from './shuttle-import.util';
import {
  GoogleSheetError,
  extractSpreadsheetId,
  getAccessToken,
  listTabs,
  parseServiceAccount,
  readTab,
} from './google-sheets.client';
import type { SaveShuttleSheetConfigDto } from './dto/shuttle-sheet.dto';

/**
 * Cột lấy theo sheet khi dòng ĐÃ CÓ trên phần mềm. Không có Tình trạng đón / Kết quả PV: 2 cột
 * này nhập trên phần mềm (người dùng 2026-11-10: "sheet chỉ để lên danh sách").
 */
const INFO_FIELDS = [
  'companyId',
  'area',
  'type',
  'saleUserId',
  'driverUserId',
  'interviewTime',
  'contractor',
  'leadSource',
  'note',
] as const;
type InfoField = (typeof INFO_FIELDS)[number];
type RowData = ParsedRow & { driverUserId: string | null };

/** Dòng trùng nhau khi cùng ngày + SĐT + họ tên (không phân biệt dấu/hoa thường). */
const rowKey = (date: string, phone: string, fullName: string) =>
  `${date}|${phone}|${fold(fullName)}`;

/** Tab của tháng hiện tại (giờ VN): "T11.2026", "11/2026", "T11-2026"… Không thấy → null. */
export function pickCurrentMonthTab(
  tabs: string[],
  now = new Date(),
): string | null {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  const re = new RegExp(
    `^(t|thang)?\\s*0?${vn.getUTCMonth() + 1}\\s*[./\\-_ ]\\s*${vn.getUTCFullYear()}$`,
  );
  return tabs.find((t) => re.test(fold(t))) ?? null;
}

/**
 * Đồng bộ Danh sách đưa đón từ Google Sheet (yêu cầu người dùng 2026-11-10) — 1 chiều sheet →
 * phần mềm, bấm nút mới chạy, 2 bước xem trước → đồng bộ. Dòng chưa có → thêm; dòng đã có (cùng
 * ngày + SĐT + tên) → cập nhật các cột thông tin mà sheet CÓ giá trị (ô trống/không đối chiếu
 * được trên sheet không xoá dữ liệu phần mềm), giữ nguyên Tình trạng đón + Kết quả PV. Dòng xoá
 * trên sheet KHÔNG xoá trên phần mềm; dòng đã xoá trên phần mềm mà sheet vẫn còn thì thêm lại (sheet là danh sách gốc).
 */
@Injectable()
export class ShuttleSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly importService: ShuttleImportService,
    private readonly auditLog: AuditLogService,
    private readonly realtime: RealtimeService,
  ) {}

  private tokenKey(): string {
    const key = this.config.get<string>('MARKETING_TOKEN_KEY');
    if (!key || key.length < 32) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình MARKETING_TOKEN_KEY (≥ 32 ký tự) trên máy chủ',
      );
    }
    return key;
  }

  async getConfig() {
    const cfg = await this.prisma.shuttleSheetConfig.findFirst();
    return {
      configured: !!cfg,
      spreadsheet_url: cfg
        ? `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}`
        : null,
      client_email: cfg?.clientEmail ?? null,
    };
  }

  /** Lưu link sheet + chìa khoá robot (chỉ Admin) — thử đọc sheet trước, đọc được mới lưu. */
  async saveConfig(dto: SaveShuttleSheetConfigDto, user: AuthenticatedUser) {
    const spreadsheetId = extractSpreadsheetId(dto.spreadsheet_url);
    if (!spreadsheetId) {
      throw new BadRequestException('Link Google Sheet không đúng');
    }
    const existing = await this.prisma.shuttleSheetConfig.findFirst();
    const secret = this.tokenKey();
    const json = dto.service_account_json?.trim();
    if (!json && !existing) {
      throw new BadRequestException('Chưa dán chìa khoá robot (file .json)');
    }
    const tabs = await this.google(async () => {
      const key = parseServiceAccount(
        json || decryptToken(existing!.encryptedKey, secret),
      );
      const found = await listTabs(spreadsheetId, await getAccessToken(key));
      return { key, found };
    });
    const data = {
      spreadsheetId,
      clientEmail: tabs.key.client_email,
      encryptedKey: json
        ? encryptToken(JSON.stringify(tabs.key), secret)
        : existing!.encryptedKey,
      updatedById: user.id,
    };
    if (existing) {
      await this.prisma.shuttleSheetConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.shuttleSheetConfig.create({ data });
    }
    await this.auditLog.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'shuttle_sheet_config',
      fieldChanged: 'spreadsheet_id',
      oldValue: existing?.spreadsheetId,
      newValue: spreadsheetId,
    });
    return { ...(await this.getConfig()), tabs: tabs.found };
  }

  async preview(tab?: string) {
    const loaded = await this.load(tab);
    if (!loaded.parsed) {
      return { tabs: loaded.tabs, tab: null };
    }
    const { parsed } = loaded;
    // NV đưa đón chỉ nhận khi khớp chính xác; không khớp → để trống, không hỏi (người dùng 2026-11-10).
    const plan = await this.plan(parsed.sheets[0]?.rows ?? [], (raw) => {
      const s = raw ? suggestAccount(raw, parsed.driverAccounts) : null;
      return s?.exact ? s.id : null;
    });
    return {
      tabs: loaded.tabs,
      tab: loaded.tab,
      ...this.importService.report(parsed),
      will_create: plan.creates.length,
      will_update: plan.updates.length,
      unchanged: plan.unchanged,
    };
  }

  async commit(
    tab: string,
    driverMapping: DriverMapping,
    user: AuthenticatedUser,
  ) {
    const { parsed } = await this.load(tab);
    if (!parsed) throw new BadRequestException('Chưa chọn tab');
    const driverIds = new Set(parsed.driverAccounts.map((a) => a.id));
    for (const id of Object.values(driverMapping)) {
      if (id !== null && (typeof id !== 'string' || !driverIds.has(id))) {
        throw new BadRequestException('NV đưa đón đã chọn không hợp lệ');
      }
    }
    const plan = await this.plan(parsed.sheets[0]?.rows ?? [], (raw) => {
      if (!raw) return null;
      if (Object.prototype.hasOwnProperty.call(driverMapping, raw)) {
        return driverMapping[raw];
      }
      const s = suggestAccount(raw, parsed.driverAccounts);
      return s?.exact ? s.id : null;
    });
    if (!plan.creates.length && !plan.updates.length) {
      return { created: 0, updated: 0 };
    }
    // Như Nhập Excel: mỗi dòng tạo sau dòng trước 1ms để trong ngày hiện đúng thứ tự sheet.
    const base = Date.now();
    await this.prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < plan.creates.length; i += 500) {
          await tx.shuttleRecord.createMany({
            data: plan.creates.slice(i, i + 500).map((data, j) => ({
              ...data,
              date: new Date(data.date),
              createdAt: new Date(base + i + j),
              createdById: user.id,
              updatedById: user.id,
            })),
          });
        }
        for (const u of plan.updates) {
          await tx.shuttleRecord.update({
            where: { id: u.id },
            data: { ...u.patch, updatedById: user.id },
          });
        }
      },
      { timeout: 60_000 },
    );
    await this.auditLog.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'shuttle_record',
      fieldChanged: 'sync_google_sheet',
      newValue: `Đồng bộ Google Sheet tab "${tab}": thêm ${plan.creates.length}, cập nhật ${plan.updates.length} dòng`,
    });
    this.realtime.emitTransportationReordered(user);
    return { created: plan.creates.length, updated: plan.updates.length };
  }

  /** Lỗi Google → thông báo tiếng Việt cho người dùng (400), không phải lỗi 500. */
  private async google<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof GoogleSheetError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }

  private async load(tab?: string) {
    const cfg = await this.prisma.shuttleSheetConfig.findFirst();
    if (!cfg) {
      throw new BadRequestException(
        'Chưa cài đặt Google Sheet — nhờ Admin dán link sheet và chìa khoá robot',
      );
    }
    const secret = this.tokenKey();
    return this.google(async () => {
      const token = await getAccessToken(
        parseServiceAccount(decryptToken(cfg.encryptedKey, secret)),
      );
      const tabs = await listTabs(cfg.spreadsheetId, token);
      const chosen = tab ?? pickCurrentMonthTab(tabs);
      if (!chosen) return { tabs, tab: null, parsed: null };
      if (!tabs.includes(chosen)) {
        throw new BadRequestException(`Sheet không có tab "${chosen}"`);
      }
      const values = await readTab(cfg.spreadsheetId, chosen, token);
      // Dùng chung bộ đọc của Nhập Excel: đổ các ô vào 1 sheet Excel tạm trong bộ nhớ.
      const ws = new Workbook().addWorksheet('sheet');
      ws.addRows(values);
      const parsed = await this.importService.parseSheets([
        { name: chosen, ws },
      ]);
      return { tabs, tab: chosen, parsed };
    });
  }

  /** So dòng trên sheet với phần mềm → dòng cần thêm / cần cập nhật. */
  private async plan(
    rows: SheetRow[],
    resolveDriver: (raw: string) => string | null,
  ) {
    const dates = [...new Set(rows.map((r) => r.data.date))];
    // Bỏ qua dòng đã xoá: sheet còn mà phần mềm đã xoá → thêm lại (người dùng 2026-11-10).
    const existing = dates.length
      ? await this.prisma.shuttleRecord.findMany({
          where: {
            date: { in: dates.map((d) => new Date(d)) },
            deletedAt: null,
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            date: true,
            fullName: true,
            phoneNumber: true,
            companyId: true,
            area: true,
            type: true,
            saleUserId: true,
            driverUserId: true,
            interviewTime: true,
            contractor: true,
            leadSource: true,
            note: true,
          },
        })
      : [];
    // Cùng 1 khoá có thể có nhiều dòng (lao động hẹn 2 lần trong ngày) → ghép lần lượt theo thứ tự.
    const byKey = new Map<string, typeof existing>();
    for (const e of existing) {
      const k = rowKey(
        e.date.toISOString().slice(0, 10),
        e.phoneNumber,
        e.fullName,
      );
      const list = byKey.get(k);
      if (list) list.push(e);
      else byKey.set(k, [e]);
    }
    const creates: RowData[] = [];
    const updates: { id: string; patch: Partial<Pick<RowData, InfoField>> }[] =
      [];
    let unchanged = 0;
    for (const { data, driverRaw } of rows) {
      const row: RowData = { ...data, driverUserId: resolveDriver(driverRaw) };
      const match = byKey
        .get(rowKey(row.date, row.phoneNumber, row.fullName))
        ?.shift();
      if (!match) {
        creates.push(row);
        continue;
      }
      const patch: Partial<Pick<RowData, InfoField>> = {};
      for (const f of INFO_FIELDS) {
        if (row[f] !== null && row[f] !== match[f]) patch[f] = row[f];
      }
      if (Object.keys(patch).length) updates.push({ id: match.id, patch });
      else unchanged++;
    }
    return { creates, updates, unchanged };
  }
}

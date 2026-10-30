import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Workbook, type Worksheet } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { hashPassword } from '../common/utils/password.util';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  type LegacyRow,
  type LegacyRowError,
  detectColumns,
  readLegacyRows,
  resultCode,
  suggestAccount,
  zaloFriendCode,
} from './legacy-import.util';

/** Tài khoản đứng tên các ghi chú nhập từ sheet cũ — không đăng nhập được. */
const SYSTEM_USERNAME = 'he_thong';
const SYSTEM_FULL_NAME = 'Hệ thống';
const DEFAULT_SOURCE = 'Khác';
export const LEGACY_MAX_ROWS = 5000;

export interface LegacyImportInput {
  buffer: Buffer;
  sheet?: string;
  teamId?: string;
  limit: number;
}

/**
 * "Tải data cũ" (yêu cầu người dùng 2026-10-30) — chuyển kho data đang quản
 * lý trên Google Sheet vào hệ thống, KHÁC "Nhập từ Excel" (chỉ 6 cột, data
 * mới, tự chia): giữ người phụ trách theo cột Nhân viên, gộp cả cột "Tình
 * trạng cuộc gọi" thành 1 ghi chú do "Hệ thống" ghi, giữ Trạng thái Zalo +
 * Kết quả. Không nhân bản data: SĐT đã có trong hệ thống → bỏ qua; SĐT lặp
 * trong file → gộp ghi chú vào dòng đầu tiên. Chỉ Admin.
 *
 * 2 bước, mỗi bước gửi lại file: preview (không ghi gì) → commit (kèm bảng
 * ghép tên nhân viên ↔ tài khoản Admin đã chốt).
 */
@Injectable()
export class LegacyImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async preview(input: LegacyImportInput) {
    const workbook = await this.loadWorkbook(input.buffer);
    const sheets = workbook.worksheets
      .filter((ws) => ws.rowCount > 0)
      .map((ws) => ws.name);
    if (!input.sheet || !input.teamId) {
      return { sheets };
    }
    const team = await this.loadTeam(input.teamId);
    const parsed = this.parse(workbook, input.sheet, input.limit);
    const { unique, mergedCount } = mergeByPhone(parsed.rows);
    const existing = await this.existingPhones(unique.map((r) => r.phone));

    const staffCounts = new Map<string, number>();
    for (const r of unique) {
      if (existing.has(r.phone)) continue;
      staffCounts.set(r.staff, (staffCounts.get(r.staff) ?? 0) + 1);
    }
    return {
      sheets,
      sheet: input.sheet,
      team: { id: team.id, name: team.name },
      members: team.members.map((m) => ({
        id: m.id,
        name: m.fullName,
        role: m.role,
      })),
      missing_columns: parsed.missingColumns,
      rows_read: parsed.rows.length + parsed.errors.length,
      will_create: unique.length - existing.size,
      merged_in_file: mergedCount,
      existing_in_system: existing.size,
      errors: parsed.errors,
      staff: [...staffCounts]
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({
          label,
          count,
          suggested_account_id: label
            ? suggestAccount(label, team.members)
            : null,
        })),
    };
  }

  async commit(
    input: LegacyImportInput & { mapping: Record<string, string | null> },
    user: AuthenticatedUser,
  ) {
    if (!input.sheet || !input.teamId) {
      throw new BadRequestException('Thiếu sheet hoặc nhóm');
    }
    const workbook = await this.loadWorkbook(input.buffer);
    const team = await this.loadTeam(input.teamId);
    const memberIds = new Set(team.members.map((m) => m.id));
    for (const [label, accountId] of Object.entries(input.mapping)) {
      if (accountId && !memberIds.has(accountId)) {
        throw new UnprocessableEntityException(
          `"${label}" được ghép với tài khoản không thuộc ${team.name}`,
        );
      }
    }

    const parsed = this.parse(workbook, input.sheet, input.limit);
    const { unique, mergedCount } = mergeByPhone(parsed.rows);
    const existing = await this.existingPhones(unique.map((r) => r.phone));
    const toCreate = unique.filter((r) => !existing.has(r.phone));

    const [systemId, sources, catalog] = await Promise.all([
      this.systemAccountId(),
      this.prisma.leadSource.findMany(),
      this.prisma.statusCatalog.findMany({
        where: { category: { in: ['zalo_friend_status', 'zalo_status'] } },
        select: { id: true, code: true },
      }),
    ]);
    const sourceByName = new Map(
      sources.map((s) => [s.name.toLowerCase(), s.id]),
    );
    const defaultSource = sourceByName.get(DEFAULT_SOURCE.toLowerCase());
    if (!defaultSource) {
      throw new UnprocessableEntityException(`Thiếu nguồn "${DEFAULT_SOURCE}"`);
    }
    const catalogId = new Map(catalog.map((c) => [c.code, c.id]));

    const now = new Date();
    const leads = toCreate.map((r) => {
      const assignedToId = input.mapping[r.staff] || null;
      const friend = zaloFriendCode(r.zaloFriend);
      const result = resultCode(r.result);
      return {
        row: r,
        data: {
          id: randomUUID(),
          fullName: r.fullName || 'Chưa có tên',
          phoneNumber: r.phone,
          birthYear: r.birthYear,
          address: r.address || null,
          sourceId: sourceByName.get(r.channel.toLowerCase()) ?? defaultSource,
          mktNote: r.mktNote || null,
          uploadedById: user.id,
          uploadedAt: now,
          assignedTeamId: team.id,
          assignedToId,
          assignedAt: assignedToId ? now : null,
          assignmentMethod: assignedToId ? ('manual' as const) : null,
          zaloFriendStatusId: friend ? (catalogId.get(friend) ?? null) : null,
          zaloStatusId: result ? (catalogId.get(result) ?? null) : null,
          lastActivityAt: r.callNotes ? now : null,
        },
      };
    });

    await this.prisma.$transaction(
      async (tx) => {
        await tx.lead.createMany({ data: leads.map((l) => l.data) });
        await tx.leadNote.createMany({
          data: leads
            .filter((l) => l.row.callNotes)
            .map((l) => ({
              leadId: l.data.id,
              createdById: systemId,
              content: l.row.callNotes,
              zaloFriendStatusId: l.data.zaloFriendStatusId,
              createdAt: now,
            })),
        });
      },
      { timeout: 120_000, maxWait: 20_000 },
    );

    const summary = {
      sheet: input.sheet,
      team: team.name,
      created: leads.length,
      unassigned: leads.filter((l) => !l.data.assignedToId).length,
      notes: leads.filter((l) => l.row.callNotes).length,
      merged_in_file: mergedCount,
      skipped_existing: unique
        .filter((r) => existing.has(r.phone))
        .map((r) => ({ row: r.row, phone: r.phone, full_name: r.fullName })),
      errors: parsed.errors,
    };
    await this.auditLog.log({
      accountId: user.id,
      actionType: 'create',
      entityType: 'legacy_import',
      newValue: JSON.stringify({
        sheet: summary.sheet,
        team: summary.team,
        created: summary.created,
        skipped_existing: summary.skipped_existing.length,
        errors: summary.errors.length,
      }),
    });
    return summary;
  }

  private async loadWorkbook(buffer: Buffer): Promise<Workbook> {
    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('Không đọc được file — cần file .xlsx');
    }
    return workbook;
  }

  private parse(workbook: Workbook, sheetName: string, limit: number) {
    const sheet: Worksheet | undefined = workbook.getWorksheet(sheetName);
    if (!sheet) {
      throw new BadRequestException(`Không có sheet "${sheetName}" trong file`);
    }
    const columns = detectColumns(sheet);
    if (!columns.phone) {
      throw new UnprocessableEntityException(
        `Sheet "${sheetName}" không có cột "SĐT" ở dòng 1`,
      );
    }
    const missingColumns = (['staff', 'fullName', 'callNotes'] as const).filter(
      (k) => !columns[k],
    );
    const { rows, errors } = readLegacyRows(sheet, columns, limit);
    return { rows, errors, missingColumns };
  }

  private async loadTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        members: {
          where: { status: 'active', role: { in: ['leader', 'sale'] } },
          select: { id: true, fullName: true, nickname: true, role: true },
          orderBy: { fullName: 'asc' },
        },
      },
    });
    if (!team) throw new BadRequestException('Không tìm thấy nhóm');
    return team;
  }

  private async existingPhones(phones: string[]): Promise<Set<string>> {
    if (phones.length === 0) return new Set();
    const found = await this.prisma.lead.findMany({
      where: { phoneNumber: { in: phones }, deletedAt: null },
      select: { phoneNumber: true },
    });
    return new Set(found.map((l) => l.phoneNumber));
  }

  /** Tạo (1 lần) tài khoản "Hệ thống" đã khóa, mật khẩu ngẫu nhiên. */
  private async systemAccountId(): Promise<string> {
    const found = await this.prisma.account.findUnique({
      where: { username: SYSTEM_USERNAME },
      select: { id: true },
    });
    if (found) return found.id;
    const created = await this.prisma.account.create({
      data: {
        username: SYSTEM_USERNAME,
        fullName: SYSTEM_FULL_NAME,
        role: 'admin',
        status: 'inactive',
        passwordHash: await hashPassword(randomBytes(24).toString('hex')),
      },
      select: { id: true },
    });
    return created.id;
  }
}

/** SĐT lặp trong file: giữ dòng đầu, nối ghi chú/ghi chú MKT của các dòng sau vào. */
export function mergeByPhone(rows: LegacyRow[]): {
  unique: LegacyRow[];
  mergedCount: number;
} {
  const byPhone = new Map<string, LegacyRow>();
  let mergedCount = 0;
  for (const r of rows) {
    const first = byPhone.get(r.phone);
    if (!first) {
      byPhone.set(r.phone, { ...r });
      continue;
    }
    mergedCount++;
    const join = (a: string, b: string) =>
      !b || a.includes(b) ? a : a ? `${a}\n${b}` : b;
    first.callNotes = join(first.callNotes, r.callNotes);
    first.mktNote = join(first.mktNote, r.mktNote);
    first.fullName ||= r.fullName;
    first.staff ||= r.staff;
    first.birthYear ??= r.birthYear;
    first.address ||= r.address;
    first.zaloFriend ||= r.zaloFriend;
    first.result ||= r.result;
  }
  return { unique: [...byPhone.values()], mergedCount };
}

export type { LegacyRowError };

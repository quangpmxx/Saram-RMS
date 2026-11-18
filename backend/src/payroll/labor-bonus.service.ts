import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import {
  DS_SALE_INCLUDE,
  toDsSaleRowResponse,
  type DsSaleRowResponseDto,
} from '../sales-entry/dto/ds-sale-response.dto';
import {
  BONUS_GROUPS,
  type BonusGroup,
} from '../sales-entry/dto/list-ds-sale-query.dto';
import type {
  LaborBonusQueryDto,
  MarkLaborBonusPaidDto,
} from './dto/labor-bonus.dto';

export const BONUS_GROUP_LABEL: Record<BonusGroup, string> = {
  sale: 'Sale',
  media: 'Media',
  recruitment: 'Tuyển dụng',
  shuttle: 'Đưa đón',
};

/** Ngày hôm nay theo giờ Việt Nam (chỉ ngày). */
function vnToday(): Date {
  const vn = new Date(Date.now() + 7 * 3600_000);
  return new Date(
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()),
  );
}

function ddmmyyyy(value: string | null): string {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

interface ExportColumn {
  header: string;
  width: number;
  value: (r: DsSaleRowResponseDto, i: number) => string | number;
}

/**
 * Kế toán › Thưởng lao động (2026-11-15): xem danh sách "Nhập thưởng lao động" của cả 4
 * bộ phận (Sale / Media / Tuyển dụng / Đưa đón) theo tháng, tải Excel, tick đã chi thưởng
 * (từng dòng hoặc cả danh sách) và hoàn tác khi tick nhầm. Tick chi → báo chuông người nhập.
 * Dòng đã chi bị khoá ở trang Nhập thưởng lao động (sales-entry.service.ts).
 */
@Injectable()
export class LaborBonusService {
  private readonly logger = new Logger(LaborBonusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly auditLog: AuditLogService,
  ) {}

  private where(
    q: LaborBonusQueryDto,
    withGroup = true,
  ): Prisma.SalesEntryRecordWhereInput {
    const where: Prisma.SalesEntryRecordWhereInput = {
      kind: 'bonus',
      deletedAt: null,
      periodYear: q.year,
      periodMonth: q.month,
    };
    if (withGroup && q.group) where.bonusGroup = q.group;
    if (q.paid === 'yes') where.paidDate = { not: null };
    if (q.paid === 'no') where.paidDate = null;
    if (q.company_id) where.companyId = q.company_id;
    const k = q.keyword?.trim();
    if (k) {
      where.OR = [
        { employeeCode: { contains: k, mode: 'insensitive' } },
        { fullName: { contains: k, mode: 'insensitive' } },
        { bankAccountNumber: { contains: k, mode: 'insensitive' } },
        { bankAccountName: { contains: k, mode: 'insensitive' } },
        { referrerName: { contains: k, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async rows(q: LaborBonusQueryDto): Promise<DsSaleRowResponseDto[]> {
    const records = await this.prisma.salesEntryRecord.findMany({
      where: this.where(q),
      include: DS_SALE_INCLUDE,
      orderBy: [{ bonusGroup: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return records.map(toDsSaleRowResponse);
  }

  async list(q: LaborBonusQueryDto) {
    const [items, grouped] = await Promise.all([
      this.rows(q),
      // Số dòng / tổng tiền từng tab (cùng bộ lọc, trừ bộ phận) — hiện trên nhãn tab.
      this.prisma.salesEntryRecord.groupBy({
        by: ['bonusGroup'],
        where: this.where(q, false),
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    const groups = Object.fromEntries(
      BONUS_GROUPS.map((g) => {
        const row = grouped.find((x) => (x.bonusGroup ?? 'sale') === g);
        return [
          g,
          {
            count: row?._count._all ?? 0,
            amount: Number(row?._sum.amount ?? 0),
          },
        ];
      }),
    );
    const sum = (list: DsSaleRowResponseDto[]) =>
      list.reduce((s, r) => s + (r.amount ?? 0), 0);
    const paid = items.filter((r) => r.paid_date);
    const unpaid = items.filter((r) => !r.paid_date);
    return {
      items,
      groups,
      summary: {
        count: items.length,
        amount: sum(items),
        paid_count: paid.length,
        paid_amount: sum(paid),
        unpaid_count: unpaid.length,
        unpaid_amount: sum(unpaid),
      },
    };
  }

  async markPaid(dto: MarkLaborBonusPaidDto, user: AuthenticatedUser) {
    const paidDate = dto.paid_date ? new Date(dto.paid_date) : vnToday();
    const targets = await this.prisma.salesEntryRecord.findMany({
      where: {
        id: { in: dto.ids },
        kind: 'bonus',
        deletedAt: null,
        paidDate: null,
      },
      select: { id: true, createdById: true, amount: true },
    });
    if (!targets.length) return { updated: 0 };
    const result = await this.prisma.salesEntryRecord.updateMany({
      where: { id: { in: targets.map((t) => t.id) }, paidDate: null },
      data: { paidDate, paidById: user.id },
    });
    await this.auditLog.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'sales_entry_record',
      entityId: targets[0].id,
      newValue: `Đã chi thưởng lao động ${result.count} khoản`,
    });

    // Báo chuông người nhập: 1 thông báo gộp / người.
    const byCreator = new Map<string, { count: number; amount: number }>();
    for (const t of targets) {
      const m = byCreator.get(t.createdById) ?? { count: 0, amount: 0 };
      m.count += 1;
      m.amount += Number(t.amount ?? 0);
      byCreator.set(t.createdById, m);
    }
    const day = ddmmyyyy(paidDate.toISOString().slice(0, 10));
    for (const [accountId, m] of byCreator) {
      await this.notify(
        accountId,
        `Kế toán đã chi ${m.count} khoản thưởng lao động (${m.amount.toLocaleString('vi-VN')}đ) ngày ${day}.`,
        user,
      );
    }
    return { updated: result.count };
  }

  async unmarkPaid(ids: string[], user: AuthenticatedUser) {
    const result = await this.prisma.salesEntryRecord.updateMany({
      where: {
        id: { in: ids },
        kind: 'bonus',
        deletedAt: null,
        paidDate: { not: null },
      },
      data: { paidDate: null, paidById: null },
    });
    if (result.count) {
      await this.auditLog.log({
        accountId: user.id,
        actionType: 'update',
        entityType: 'sales_entry_record',
        entityId: ids[0],
        newValue: `Bỏ đánh dấu đã chi ${result.count} khoản thưởng lao động`,
      });
    }
    return { updated: result.count };
  }

  async exportXlsx(q: LaborBonusQueryDto) {
    const rows = await this.rows(q);
    const columns: ExportColumn[] = [
      { header: 'STT', width: 6, value: (_r, i) => i + 1 },
      {
        header: 'Bộ phận',
        width: 12,
        value: (r) =>
          BONUS_GROUP_LABEL[(r.bonus_group ?? 'sale') as BonusGroup] ?? '',
      },
      { header: 'ID', width: 14, value: (r) => r.employee_code ?? '' },
      { header: 'Tên', width: 26, value: (r) => r.full_name ?? '' },
      { header: 'Công ty', width: 20, value: (r) => r.company?.name ?? '' },
      { header: 'Ngày vào', width: 12, value: (r) => ddmmyyyy(r.join_date) },
      { header: 'Số tiền', width: 14, value: (r) => r.amount ?? '' },
      { header: 'STK', width: 20, value: (r) => r.bank_account_number ?? '' },
      { header: 'Tên TK', width: 26, value: (r) => r.bank_account_name ?? '' },
      { header: 'Ngân hàng', width: 16, value: (r) => r.bank_name ?? '' },
      {
        header: 'Người giới thiệu',
        width: 20,
        value: (r) => r.referrer_name ?? '',
      },
      {
        header: 'Sale / Người tuyển',
        width: 20,
        value: (r) => r.sale?.nickname || r.sale?.full_name || '',
      },
      { header: 'Ghi chú', width: 36, value: (r) => r.note ?? '' },
      {
        header: 'Trạng thái',
        width: 12,
        value: (r) => (r.paid_date ? 'Đã chi' : 'Chưa chi'),
      },
      { header: 'Ngày chi', width: 12, value: (r) => ddmmyyyy(r.paid_date) },
      { header: 'Người chi', width: 20, value: (r) => r.paid_by?.name ?? '' },
    ];
    const AMOUNT_COL = 7;
    const groupLabel = q.group ? BONUS_GROUP_LABEL[q.group] : 'Chung';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Thưởng ${groupLabel}`, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = columns.map((c) => ({ width: c.width }));
    const border = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };
    const allBorders = {
      top: border,
      left: border,
      bottom: border,
      right: border,
    };
    const header = sheet.addRow(columns.map((c) => c.header));
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = allBorders;
    });
    // Dòng "TỔNG" ngay dưới tiêu đề, như file Excel mẫu của Nhập thưởng.
    const total = sheet.addRow(
      columns.map((_c, i) =>
        i === 3
          ? 'TỔNG'
          : i === AMOUNT_COL - 1
            ? rows.reduce((s, r) => s + (r.amount ?? 0), 0)
            : '',
      ),
    );
    total.font = { bold: true };
    rows.forEach((r, i) => {
      const row = sheet.addRow(columns.map((c) => c.value(r, i)));
      row.eachCell((cell) => {
        cell.border = allBorders;
      });
    });
    sheet.getColumn(AMOUNT_COL).numFmt = '#,##0';
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const filename = `Thuong-lao-dong_${q.group ?? 'chung'}_${q.year}-${String(q.month).padStart(2, '0')}.xlsx`;
    return { buffer, filename };
  }

  private async notify(
    accountId: string,
    content: string,
    sender: AuthenticatedUser,
  ): Promise<void> {
    if (accountId === sender.id) return;
    try {
      const now = new Date();
      const notification = await this.prisma.notification.create({
        data: {
          accountId,
          type: 'labor_bonus_paid',
          channel: 'in_app',
          content: content.slice(0, 500),
          senderId: sender.id,
          scheduledAt: now,
          sentAt: now,
          status: 'sent',
          meta: { link: '/sales-entry?tab=bonus' },
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
    } catch (error) {
      this.logger.error('Gửi thông báo chi thưởng thất bại', error as Error);
    }
  }
}

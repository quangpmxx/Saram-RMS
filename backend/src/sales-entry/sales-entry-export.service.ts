import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { SalesEntryService } from './sales-entry.service';
import { ListDsSaleQueryDto, type DsKind } from './dto/list-ds-sale-query.dto';
import type {
  DsSaleAccountOptionDto,
  DsSaleRowResponseDto,
} from './dto/ds-sale-response.dto';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

const HEADER_FILL = 'FF1E3A8A';
const HEADER_FONT_COLOR = 'FFFFFFFF';
const THIN_BORDER: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: 'FFCBD5E1' },
};

function toDdMmYyyy(dateOnly: string | null): string {
  if (!dateOnly) return '';
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
}

interface ExportColumn {
  header: string;
  width: number;
  /** Ô dài (quê quán, ghi chú) — xuống dòng trong ô. */
  wrap?: boolean;
  value: (row: DsSaleRowResponseDto, index: number) => string | number;
}

const personName = (account: DsSaleAccountOptionDto | null): string =>
  account?.full_name ?? '';

const SALE_COLUMNS: ExportColumn[] = [
  { header: 'STT', width: 6, value: (_row, index) => index + 1 },
  { header: 'Mã NV', width: 14, value: (row) => row.employee_code ?? '' },
  { header: 'Họ tên', width: 26, value: (row) => row.full_name ?? '' },
  {
    header: 'Ngày sinh',
    width: 14,
    value: (row) => toDdMmYyyy(row.date_of_birth),
  },
  {
    header: 'Số CMT/CCCD',
    width: 18,
    value: (row) => row.identity_number ?? '',
  },
  {
    header: 'Quê quán',
    width: 32,
    wrap: true,
    value: (row) => row.hometown ?? '',
  },
  { header: 'SĐT', width: 16, value: (row) => row.phone ?? '' },
  { header: 'Ngày vào', width: 14, value: (row) => toDdMmYyyy(row.join_date) },
  { header: 'Công ty làm', width: 24, value: (row) => row.company?.name ?? '' },
  { header: 'Sale', width: 22, value: (row) => personName(row.sale) },
  { header: 'Đưa đón', width: 22, value: (row) => personName(row.pickup) },
  { header: 'Ghi chú', width: 44, wrap: true, value: (row) => row.note ?? '' },
];

/** DS Media / DS Tuyển dụng / DS Đưa đón — đúng thứ tự cột file Excel mẫu của user (2026-11-12). */
const STAFF_COLUMNS: ExportColumn[] = [
  { header: 'STT', width: 6, value: (_row, index) => index + 1 },
  { header: 'Mã NV', width: 14, value: (row) => row.employee_code ?? '' },
  { header: 'Họ tên', width: 26, value: (row) => row.full_name ?? '' },
  {
    header: 'Ngày sinh',
    width: 14,
    value: (row) => toDdMmYyyy(row.date_of_birth),
  },
  { header: 'Số CMT', width: 18, value: (row) => row.identity_number ?? '' },
  {
    header: 'Quê quán',
    width: 32,
    wrap: true,
    value: (row) => row.hometown ?? '',
  },
  { header: 'Công ty', width: 24, value: (row) => row.company?.name ?? '' },
  { header: 'Ngày vào', width: 14, value: (row) => toDdMmYyyy(row.join_date) },
  { header: 'Tình trạng', width: 18, value: (row) => row.work_status ?? '' },
  { header: 'Người tuyển', width: 22, value: (row) => personName(row.sale) },
  { header: 'Check', width: 22, value: (row) => personName(row.check) },
  { header: 'Note', width: 36, wrap: true, value: (row) => row.note ?? '' },
  { header: 'Tổng công', width: 12, value: (row) => row.total_days ?? '' },
  { header: 'Tổng giờ', width: 12, value: (row) => row.total_hours ?? '' },
];

/** Tab Nhập thưởng — đúng thứ tự cột file Excel mẫu của user (2026-11-12). */
const BONUS_COLUMNS: ExportColumn[] = [
  { header: 'STT', width: 6, value: (_row, index) => index + 1 },
  { header: 'ID', width: 16, value: (row) => row.employee_code ?? '' },
  { header: 'Tên', width: 26, value: (row) => row.full_name ?? '' },
  { header: 'Công ty', width: 20, value: (row) => row.company?.name ?? '' },
  { header: 'Ngày vào', width: 14, value: (row) => toDdMmYyyy(row.join_date) },
  { header: 'Số tiền', width: 16, value: (row) => row.amount ?? '' },
  { header: 'STK', width: 20, value: (row) => row.bank_account_number ?? '' },
  { header: 'Tên TK', width: 26, value: (row) => row.bank_account_name ?? '' },
  { header: 'Ngân hàng', width: 18, value: (row) => row.bank_name ?? '' },
  {
    header: 'Người giới thiệu',
    width: 22,
    value: (row) => row.referrer_name ?? '',
  },
  { header: 'Sale', width: 20, value: (row) => personName(row.sale) },
  { header: 'Ghi chú', width: 44, wrap: true, value: (row) => row.note ?? '' },
  { header: 'Ngày chi', width: 14, value: (row) => toDdMmYyyy(row.paid_date) },
];

/** Vị trí (1-based) cột "Số tiền" trong BONUS_COLUMNS — để định dạng số và ghi dòng Tổng. */
const BONUS_AMOUNT_COLUMN = 6;

const COLUMNS_BY_KIND: Record<DsKind, ExportColumn[]> = {
  sale: SALE_COLUMNS,
  media: STAFF_COLUMNS,
  recruitment: STAFF_COLUMNS,
  shuttle: STAFF_COLUMNS,
  bonus: BONUS_COLUMNS,
};

const SHEET_NAMES: Record<DsKind, string> = {
  sale: 'DS Sale',
  media: 'DS Media',
  recruitment: 'DS Tuyển dụng',
  shuttle: 'DS Đưa đón',
  bonus: 'Thưởng',
};

const FILE_PREFIXES: Record<DsKind, string> = {
  sale: 'DS-Sale',
  media: 'DS-Media',
  recruitment: 'DS-Tuyen-dung',
  shuttle: 'DS-Dua-don',
  bonus: 'Danh-sach-thuong',
};

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, yêu cầu trực tiếp người
 * dùng): xuất Excel "DS Sale" — tách riêng khỏi SalesEntryService (giữ
 * service nghiệp vụ gọn, khớp cách attendance.service.ts đặt exportXlsx()
 * ngay trong service chính, nhưng ở đây tách file riêng vì phần định dạng
 * ExcelJS khá dài). Mục 12: không xuất id nội bộ, chỉ tên Sale/Đưa đón;
 * STT đánh lại từ 1 trong file xuất (khác STT hiển thị theo trang trên
 * màn hình).
 */
@Injectable()
export class SalesEntryExportService {
  constructor(private readonly salesEntryService: SalesEntryService) {}

  async exportXlsx(
    query: ListDsSaleQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await this.salesEntryService.exportRows(query, currentUser);

    const kind: DsKind = query.kind ?? 'sale';
    const COLUMNS = COLUMNS_BY_KIND[kind];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(SHEET_NAMES[kind], {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = COLUMNS.map((col) => ({ width: col.width }));

    const headerRow = sheet.addRow(COLUMNS.map((col) => col.header));
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: HEADER_FONT_COLOR } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: THIN_BORDER,
        left: THIN_BORDER,
        bottom: THIN_BORDER,
        right: THIN_BORDER,
      };
    });

    if (kind === 'bonus') {
      // Dòng "TỔNG" ngay dưới tiêu đề, như file Excel mẫu.
      const totalRow = sheet.addRow(
        COLUMNS.map((_col, i) =>
          i === 2
            ? 'TỔNG'
            : i === BONUS_AMOUNT_COLUMN - 1
              ? rows.reduce((sum, row) => sum + (row.amount ?? 0), 0)
              : '',
        ),
      );
      totalRow.font = { bold: true };
      totalRow.getCell(BONUS_AMOUNT_COLUMN).numFmt = '#,##0';
      sheet.getColumn(BONUS_AMOUNT_COLUMN).numFmt = '#,##0';
    }

    rows.forEach((row, index) => {
      const excelRow = sheet.addRow(
        COLUMNS.map((col) => col.value(row, index)),
      );
      excelRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: THIN_BORDER,
          left: THIN_BORDER,
          bottom: THIN_BORDER,
          right: THIN_BORDER,
        };
        if (COLUMNS[colNumber - 1]?.wrap) {
          cell.alignment = { wrapText: true, vertical: 'top' };
        }
      });
    });

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: COLUMNS.length },
    };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filename = `${FILE_PREFIXES[kind]}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
      now.getHours(),
    )}-${pad(now.getMinutes())}.xlsx`;

    return { buffer, filename };
  }
}

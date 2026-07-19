import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { SalesEntryService } from './sales-entry.service';
import { ListDsSaleQueryDto } from './dto/list-ds-sale-query.dto';

const HEADER_FILL = 'FF1E3A8A';
const HEADER_FONT_COLOR = 'FFFFFFFF';
const THIN_BORDER: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: 'FFCBD5E1' },
};

const COLUMNS: Array<{ header: string; width: number }> = [
  { header: 'STT', width: 6 },
  { header: 'Mã NV', width: 14 },
  { header: 'Họ tên', width: 26 },
  { header: 'Ngày sinh', width: 14 },
  { header: 'Số CMT/CCCD', width: 18 },
  { header: 'Quê quán', width: 32 },
  { header: 'Ngày vào', width: 14 },
  { header: 'Công ty làm', width: 24 },
  { header: 'Sale', width: 22 },
  { header: 'Đưa đón', width: 22 },
  { header: 'Ghi chú', width: 44 },
];

function toDdMmYyyy(dateOnly: string | null): string {
  if (!dateOnly) return '';
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
}

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
  ): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await this.salesEntryService.exportRows(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('DS Sale', {
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

    rows.forEach((row, index) => {
      const excelRow = sheet.addRow([
        index + 1,
        row.employee_code ?? '',
        row.full_name ?? '',
        toDdMmYyyy(row.date_of_birth),
        row.identity_number ?? '',
        row.hometown ?? '',
        toDdMmYyyy(row.join_date),
        row.company?.name ?? '',
        row.sale?.full_name ?? '',
        row.pickup?.full_name ?? '',
        row.note ?? '',
      ]);
      excelRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: THIN_BORDER,
          left: THIN_BORDER,
          bottom: THIN_BORDER,
          right: THIN_BORDER,
        };
        // Cột "Quê quán" (6) và "Ghi chú" (11) — wrap text (Mục 12).
        if (colNumber === 6 || colNumber === 11) {
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
    const filename = `DS-Sale_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
      now.getHours(),
    )}-${pad(now.getMinutes())}.xlsx`;

    return { buffer, filename };
  }
}

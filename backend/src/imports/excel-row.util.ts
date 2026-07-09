import type { Row } from 'exceljs';

function toDisplayString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return '';
}

/** Chuẩn hóa 1 ô Excel về chuỗi đã trim — ExcelJS trả nhiều kiểu giá trị khác nhau. */
export function getCellText(row: Row, column: number): string {
  const value: unknown = row.getCell(column).value;

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    const richValue = value as { text?: unknown; result?: unknown };
    if ('text' in richValue) {
      return toDisplayString(richValue.text).trim();
    }
    if ('result' in richValue) {
      return toDisplayString(richValue.result).trim();
    }
    return '';
  }

  return toDisplayString(value).trim();
}

export function isRowEmpty(row: Row): boolean {
  return getCellText(row, 1) === '' && getCellText(row, 2) === '';
}

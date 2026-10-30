import type { Worksheet } from 'exceljs';
import { getCellText } from './excel-row.util';

/**
 * "Tải data cũ" (yêu cầu người dùng 2026-10-30) — đọc thẳng file Excel tải
 * từ Google Sheet "DATA MKT" của từng nhóm. Cột được nhận diện theo TÊN
 * tiêu đề ở dòng 1 (mỗi sheet tháng xếp cột khác nhau), không theo vị trí.
 */
export const LEGACY_COLUMNS = {
  staff: ['nhân viên'],
  fullName: ['họ tên ứng viên', 'họ tên', 'tên ứng viên'],
  phone: ['sđt', 'số điện thoại'],
  birthYear: ['năm sinh'],
  address: ['địa chỉ'],
  mktNote: ['ghi chú mkt'],
  channel: ['kênh'],
  zaloFriend: ['trạng thái'],
  callNotes: ['tình trạng cuộc gọi'],
  result: ['kết quả'],
} as const;

export type LegacyColumnKey = keyof typeof LEGACY_COLUMNS;

export interface LegacyRow {
  /** Số dòng trong sheet (để báo lỗi). */
  row: number;
  staff: string;
  fullName: string;
  phone: string;
  birthYear: number | null;
  address: string;
  mktNote: string;
  channel: string;
  zaloFriend: string;
  callNotes: string;
  result: string;
}

export interface LegacyRowError {
  row: number;
  message: string;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Tìm vị trí từng cột theo tiêu đề dòng 1. */
export function detectColumns(
  sheet: Worksheet,
): Partial<Record<LegacyColumnKey, number>> {
  const header = sheet.getRow(1);
  const found: Partial<Record<LegacyColumnKey, number>> = {};
  for (let c = 1; c <= sheet.columnCount; c++) {
    const title = norm(getCellText(header, c));
    if (!title) continue;
    for (const key of Object.keys(LEGACY_COLUMNS) as LegacyColumnKey[]) {
      if (
        found[key] === undefined &&
        (LEGACY_COLUMNS[key] as readonly string[]).includes(title)
      ) {
        found[key] = c;
      }
    }
  }
  return found;
}

/**
 * Lấy SĐT đầu tiên hợp lệ trong ô (ô có thể ghi "0912.345.678", "84912345678",
 * thiếu số 0 đầu do Sheet tự bỏ, hoặc 2 số). Trả về null nếu không có.
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s.\-()]/g, '');
  const match = compact.match(/(?:\+?84|0)?\d{9}/);
  if (!match) return null;
  let digits = match[0].replace(/^\+/, '');
  if (digits.startsWith('84') && digits.length === 11) digits = digits.slice(2);
  if (digits.length === 9) digits = `0${digits}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
}

/**
 * Năm sinh viết tự do: "1989", "89", "2k5", "k5", "82, 2k6" (lấy giá trị
 * đầu). Không đọc được → null.
 */
export function parseBirthYear(raw: string, now = new Date()): number | null {
  const token =
    raw
      .trim()
      .toLowerCase()
      .split(/[,;/\s]+/)[0] ?? '';
  let year: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = token.match(/^(19\d{2}|20\d{2})$/))) year = Number(m[1]);
  else if ((m = token.match(/^2?k(\d{1,2})$/))) year = 2000 + Number(m[1]);
  else if ((m = token.match(/^(\d{2})$/))) {
    const yy = Number(m[1]);
    year = yy <= now.getFullYear() % 100 ? 2000 + yy : 1900 + yy;
  }
  if (year === null || year < 1940 || year > now.getFullYear()) return null;
  return year;
}

/**
 * Đọc tối đa `limit` dòng có SĐT tính từ đầu sheet. Dòng trống bị bỏ qua
 * (không tính vào limit). Dòng có ô SĐT nhưng sai định dạng → lỗi (có tính).
 */
export function readLegacyRows(
  sheet: Worksheet,
  columns: Partial<Record<LegacyColumnKey, number>>,
  limit: number,
): { rows: LegacyRow[]; errors: LegacyRowError[] } {
  const rows: LegacyRow[] = [];
  const errors: LegacyRowError[] = [];
  const cell = (r: number, key: LegacyColumnKey) =>
    columns[key] ? getCellText(sheet.getRow(r), columns[key]) : '';

  for (
    let r = 2;
    r <= sheet.rowCount && rows.length + errors.length < limit;
    r++
  ) {
    const rawPhone = cell(r, 'phone');
    if (!rawPhone) continue;
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      errors.push({ row: r, message: `SĐT không hợp lệ: "${rawPhone}"` });
      continue;
    }
    let birthRaw = cell(r, 'birthYear');
    let address = cell(r, 'address');
    // Sheet hay ghi lệch: Năm sinh = "lạng sơn", Địa chỉ = "84" → đổi chỗ.
    if (
      birthRaw &&
      parseBirthYear(birthRaw) === null &&
      parseBirthYear(address) !== null
    ) {
      [birthRaw, address] = [address, birthRaw];
    }
    rows.push({
      row: r,
      staff: cell(r, 'staff').replace(/\s+/g, ' '),
      fullName: cell(r, 'fullName').slice(0, 150),
      phone,
      birthYear: birthRaw ? parseBirthYear(birthRaw) : null,
      address: address.slice(0, 255),
      mktNote: cell(r, 'mktNote'),
      channel: cell(r, 'channel'),
      zaloFriend: cell(r, 'zaloFriend'),
      callNotes: cell(r, 'callNotes'),
      result: cell(r, 'result'),
    });
  }
  return { rows, errors };
}

/** Mã trạng thái Zalo trong danh mục từ chữ trên sheet. */
export function zaloFriendCode(
  raw: string,
): 'FRIEND' | 'NOT_FRIEND' | 'NO_ZALO' | null {
  const t = norm(raw);
  if (!t) return null;
  if (t.includes('không có')) return 'NO_ZALO';
  if (t.includes('chưa')) return 'NOT_FRIEND';
  if (t.includes('đã')) return 'FRIEND';
  return null;
}

/** "Đã gửi CC" / "Đã gửi CCCD" → mã SENT_CCCD. */
export function resultCode(raw: string): 'SENT_CCCD' | null {
  return /cc/i.test(raw) ? 'SENT_CCCD' : null;
}

/**
 * Gợi ý tài khoản cho tên viết tắt ở cột Nhân viên ("Vương", "K.Linh",
 * "M.Ánh", "Ngọc Anh"): ưu tiên trùng biệt danh; sau đó họ tên phải KẾT
 * THÚC bằng phần tên (phân biệt dấu: "Anh" ≠ "Ánh"); có chữ viết tắt trước
 * dấu chấm thì 1 chữ khác trong họ tên phải bắt đầu bằng chữ đó. Chỉ gợi ý
 * khi ra đúng 1 người.
 */
export function suggestAccount(
  label: string,
  members: { id: string; fullName: string; nickname: string | null }[],
): string | null {
  const l = norm(label);
  if (!l) return null;
  const byNick = members.filter((m) => m.nickname && norm(m.nickname) === l);
  if (byNick.length === 1) return byNick[0].id;

  const dot = l.match(/^(\p{L})\.\s*(.+)$/u);
  const initial = dot ? dot[1] : null;
  const given = (dot ? dot[2] : l).split(' ');
  const strip = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

  const hits = members.filter((m) => {
    const words = norm(m.fullName).split(' ');
    if (words.length < given.length) return false;
    const tail = words.slice(words.length - given.length);
    if (tail.join(' ') !== given.join(' ')) return false;
    if (!initial) return true;
    return words
      .slice(0, words.length - given.length)
      .some((w) => strip(w)[0] === strip(initial));
  });
  return hits.length === 1 ? hits[0].id : null;
}

import type { Worksheet } from 'exceljs';
import { getCellText } from '../imports/excel-row.util';
import { normalizePhone } from '../imports/legacy-import.util';

/**
 * Nhập danh sách đưa đón cũ từ Excel (yêu cầu người dùng 2026-11-08). Nguyên tắc: ô nào phần
 * mềm không đối chiếu được (công ty, Sale, lựa chọn…) thì ĐỂ TRỐNG để người dùng tự nhập sau.
 */

/** Bỏ dấu + chữ thường + gộp khoảng trắng — để so tiêu đề/giá trị không phân biệt cách gõ. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Tiêu đề cột chấp nhận (so sau khi fold). */
export const SHUTTLE_COLUMNS = {
  date: ['ngay', 'ngay pv', 'ngay phong van', 'ngay don', 'ngay di'],
  fullName: [
    'ho ten',
    'ho va ten',
    'ten',
    'ten lao dong',
    'thong tin lao dong',
    'lao dong',
    'ten ung vien',
    'ung vien',
    'ten lđ',
  ],
  phone: ['sdt', 'so dien thoai', 'so dt', 'dien thoai', 'sđt', 'phone'],
  company: ['cong ty', 'cty', 'don hang', 'ten cong ty'],
  area: ['khu vuc', 'kv', 'kcn', 'khu cong nghiep'],
  type: ['loai hinh', 'loai'],
  sale: ['sale', 'nv sale', 'nhan vien sale', 'nguoi tuyen', 'tuyen dung'],
  driver: ['nv dua don', 'dua don', 'nguoi don', 'nhan vien dua don', 'lai xe'],
  interviewTime: ['gio pv', 'gio', 'gio phong van', 'gio hen', 'gio hen pv'],
  contractor: ['nha thau'],
  status: ['tinh trang', 'tinh trang don', 'trang thai'],
  interviewResult: ['ket qua', 'ket qua pv', 'ket qua phong van'],
  leadSource: ['nguon'],
  note: ['ghi chu', 'note'],
} as const;

export type ShuttleColumnKey = keyof typeof SHUTTLE_COLUMNS;

export const COLUMN_LABEL: Record<ShuttleColumnKey, string> = {
  date: 'Ngày',
  fullName: 'Họ tên',
  phone: 'SĐT',
  company: 'Công ty',
  area: 'Khu vực',
  type: 'Loại hình',
  sale: 'Sale',
  driver: 'NV Đưa đón',
  interviewTime: 'Giờ PV',
  contractor: 'Nhà thầu',
  status: 'Tình trạng',
  interviewResult: 'Kết quả',
  leadSource: 'Nguồn',
  note: 'Ghi chú',
};

/** Tìm dòng tiêu đề trong 10 dòng đầu: dòng có cột Ngày + (Họ tên hoặc SĐT). */
export function detectShuttleHeader(
  sheet: Worksheet,
): { row: number; columns: Partial<Record<ShuttleColumnKey, number>> } | null {
  const maxRow = Math.min(10, sheet.rowCount);
  for (let r = 1; r <= maxRow; r++) {
    const header = sheet.getRow(r);
    const columns: Partial<Record<ShuttleColumnKey, number>> = {};
    for (let c = 1; c <= sheet.columnCount; c++) {
      const title = fold(getCellText(header, c));
      if (!title) continue;
      for (const key of Object.keys(SHUTTLE_COLUMNS) as ShuttleColumnKey[]) {
        if (
          columns[key] === undefined &&
          (SHUTTLE_COLUMNS[key] as readonly string[]).includes(title)
        ) {
          columns[key] = c;
          break;
        }
      }
    }
    if (columns.date && (columns.fullName || columns.phone)) {
      return { row: r, columns };
    }
  }
  return null;
}

/**
 * Ngày trong sheet → "YYYY-MM-DD". Nhận ô ngày Excel (ISO), "d/m/yyyy", "yyyy-mm-dd", "d/m"
 * (không năm → năm nay, nếu ra ngày tương lai thì năm ngoái). Không đọc được → null.
 */
export function parseShuttleDate(raw: string, now = new Date()): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (match) {
    [y, m, d] = [+match[1], +match[2], +match[3]];
  } else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) {
    [d, m, y] = [+match[1], +match[2], +match[3]];
    if (y < 100) y += 2000;
  } else if ((match = /^(\d{1,2})[/.-](\d{1,2})$/.exec(s))) {
    [d, m] = [+match[1], +match[2]];
    const vn = new Date(now.getTime() + 7 * 3600_000);
    y = vn.getUTCFullYear();
    const today = vn.toISOString().slice(0, 10);
    const candidate = toIso(y, m, d);
    if (candidate && candidate > today) y -= 1;
  } else {
    return null;
  }
  return toIso(y, m, d);
}

function toIso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    y < 2000 ||
    y > 2100 ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Giờ PV → "HH:mm". Nhận ô giờ Excel (ISO 1899-12-30T08:30), số thập phân (0.35 = 8:24),
 * "8:30", "8h30", "8h", "08.30". Không đọc được → null (để trống).
 */
export function parseShuttleTime(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  let h: number, min: number;
  let match = /^\d{4}-\d{2}-\d{2}t(\d{2}):(\d{2})/.exec(s);
  if (match) {
    [h, min] = [+match[1], +match[2]];
  } else if (/^0?\.\d+$/.test(s)) {
    const total = Math.round(parseFloat(s) * 24 * 60);
    [h, min] = [Math.floor(total / 60), total % 60];
  } else if (
    (match = /^(\d{1,2})\s*(?:[:h.]\s*(\d{1,2})?)?\s*(?:p|phut)?$/.exec(s))
  ) {
    [h, min] = [+match[1], match[2] ? +match[2] : 0];
  } else {
    return null;
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Tên + SĐT: ưu tiên cột riêng; nếu sheet gộp 1 cột ("Nguyễn Văn A - 0912345678") thì tách SĐT
 * ra khỏi tên. SĐT không đọc được → rỗng.
 */
export function splitNamePhone(
  nameCell: string,
  phoneCell: string,
): { fullName: string; phone: string } {
  let phone = normalizePhone(phoneCell) ?? '';
  let fullName = nameCell.trim();
  if (!phone) {
    const inName = normalizePhone(fullName);
    if (inName) {
      phone = inName;
      fullName = fullName
        .replace(/(?:\+?84|0)?[\d\s.\-()]{9,}/, ' ')
        .replace(/[-–,:|/]+\s*$/, '')
        .replace(/^\s*[-–,:|/]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  return { fullName: fullName.slice(0, 150), phone };
}

/** Sheet hay ghi NV đưa đón kèm SĐT ("Chuyền 0373791063") → chỉ lấy tên để đối chiếu tài khoản. */
export function stripTrailingPhone(label: string): string {
  const name = label
    .replace(/[\s\-–:,(]*(?:\+?84|0)\d[\d\s.]{7,}\)?\s*$/, '')
    .trim();
  return name || label.trim();
}

/** Đối chiếu tài khoản theo biệt danh hoặc họ tên đầy đủ/tên (không dấu); trùng nhiều người → không khớp. */
export function matchAccount(
  label: string,
  accounts: { id: string; fullName: string; nickname: string | null }[],
): string | null {
  const l = fold(label);
  if (!l) return null;
  const unique = (hits: { id: string }[]) =>
    hits.length === 1 ? hits[0].id : null;
  const byNick = accounts.filter((a) => a.nickname && fold(a.nickname) === l);
  if (byNick.length) return unique(byNick);
  const byFull = accounts.filter((a) => fold(a.fullName) === l);
  if (byFull.length) return unique(byFull);
  // Chỉ ghi tên gọi ("Hương", "Thu Hà") → khớp đuôi họ tên.
  const words = l.split(' ');
  return unique(
    accounts.filter((a) => {
      const full = fold(a.fullName).split(' ');
      return (
        full.length > words.length &&
        full.slice(full.length - words.length).join(' ') === l
      );
    }),
  );
}

/**
 * Đồng bộ Google Sheet tự gán NV đưa đón (người dùng 2026-11-13: "tự đồng bộ, sai thì mới bỏ
 * trống"): bỏ SĐT đi kèm → khớp biệt danh / họ tên / tên gọi (đúng 1 người) → nếu không, nhận
 * tên gõ sai nhẹ (giống ≥ 85% và hơn hẳn người giống thứ hai). Không chắc → null (để trống).
 */
export function autoMatchDriver(
  label: string,
  accounts: { id: string; fullName: string; nickname: string | null }[],
): string | null {
  const name = stripTrailingPhone(label);
  const hit = matchAccount(name, accounts);
  if (hit) return hit;
  const l = fold(name);
  if (!l) return null;
  const lWords = l.split(' ').length;
  const scores = accounts
    .map((a) => {
      const full = fold(a.fullName);
      const candidates = [
        full,
        a.nickname ? fold(a.nickname) : '',
        full.split(' ').slice(-lWords).join(' '),
      ];
      return {
        id: a.id,
        score: Math.max(...candidates.map((c) => similarity(l, c))),
      };
    })
    .sort((x, y) => y.score - x.score);
  const [best, second] = scores;
  if (!best || best.score < 0.85) return null;
  if (second && second.score > best.score - 0.1) return null;
  return best.id;
}

/** Cách ghi trong sheet → lựa chọn cố định của phần mềm (so sau khi fold). */
export const STATUS_ALIASES: Record<string, string> = {
  'khong don duoc': 'Chưa đón được',
  'ko don duoc': 'Chưa đón được',
};

/** Độ giống 2 chuỗi đã fold: 1 = y hệt, 0 = khác hẳn (theo khoảng cách sửa chữ Levenshtein). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/**
 * NV đưa đón (yêu cầu người dùng 2026-11-08): khớp CHÍNH XÁC (biệt danh hoặc họ tên, không phân
 * biệt dấu/hoa thường, đúng 1 người) → `exact`; không thì gợi ý tài khoản giống nhất (so với biệt
 * danh, họ tên, tên gọi) để người dùng xác nhận trước khi nhập. Không ai đủ giống → null.
 */
export function suggestAccount(
  label: string,
  accounts: { id: string; fullName: string; nickname: string | null }[],
): { id: string; exact: boolean } | null {
  const l = fold(label);
  if (!l) return null;
  const exact = accounts.filter(
    (a) => fold(a.fullName) === l || (a.nickname && fold(a.nickname) === l),
  );
  if (exact.length === 1) return { id: exact[0].id, exact: true };
  let best: { id: string; score: number } | null = null;
  for (const a of accounts) {
    const full = fold(a.fullName);
    const words = full.split(' ');
    const lWords = l.split(' ').length;
    const candidates = [
      full,
      a.nickname ? fold(a.nickname) : '',
      words.slice(-lWords).join(' '),
    ];
    const score = Math.max(...candidates.map((c) => similarity(l, c)));
    if (!best || score > best.score) best = { id: a.id, score };
  }
  return best && best.score >= 0.5 ? { id: best.id, exact: false } : null;
}

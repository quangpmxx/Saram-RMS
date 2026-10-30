/**
 * Kho chăm sóc — mốc ngày/tháng theo giờ Việt Nam, cùng quy ước với
 * daily-reports.service.ts (`T00:00:00.000+07:00`). Việt Nam không có giờ
 * mùa hè nên offset +07:00 cố định là chính xác.
 */
export const TIMEZONE = 'Asia/Ho_Chi_Minh';

const VN_OFFSET = '+07:00';

/**
 * Tạo 1 lần dùng mãi: Intl.DateTimeFormat rất tốn CPU khi khởi tạo, mà hàm
 * này được gọi hàng chục nghìn lần mỗi request Kho/Báo cáo tiến độ (đo
 * 2026-10-30: ~75% CPU của 2 API đó).
 */
const VN_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "YYYY-MM-DD" theo giờ Việt Nam. */
export function vnDateOnly(date: Date): string {
  return VN_DATE_FORMAT.format(date);
}

/** "YYYY-MM" theo giờ Việt Nam. */
export function vnMonthKey(date: Date): string {
  return vnDateOnly(date).slice(0, 7);
}

/** Khoảng [start, end) của 1 ngày dương lịch giờ Việt Nam. */
export function vnDayRange(dateOnly: string): { start: Date; end: Date } {
  const start = new Date(`${dateOnly}T00:00:00.000${VN_OFFSET}`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Khoảng [start, end) của 1 tháng giờ Việt Nam ("YYYY-MM"). */
export function vnMonthRange(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: new Date(`${monthKey}-01T00:00:00.000${VN_OFFSET}`),
    end: new Date(
      `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000${VN_OFFSET}`,
    ),
  };
}

/** Đầu tháng (giờ VN) chứa `date`. */
export function vnMonthStart(date: Date): Date {
  return vnMonthRange(vnMonthKey(date)).start;
}

/** Đầu tháng KẾ TIẾP (giờ VN) sau tháng chứa `date`. */
export function vnNextMonthStart(date: Date): Date {
  return vnMonthRange(vnMonthKey(date)).end;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Số thứ tự ngày theo giờ VN — 2 mốc cùng số = cùng 1 ngày lịch VN. */
export function vnDayIndex(date: Date): number {
  return Math.floor((date.getTime() + VN_OFFSET_MS) / DAY_MS);
}

/**
 * Số lần chăm sóc của 1 data = số NGÀY khác nhau (giờ VN) có ghi chú (yêu
 * cầu người dùng 2026-10-30): cùng 1 ngày dù nhiều người/nhiều ghi chú chỉ
 * tính 1 lần.
 */
export function countCareDays(dates: Date[]): number {
  return new Set(dates.map(vnDayIndex)).size;
}

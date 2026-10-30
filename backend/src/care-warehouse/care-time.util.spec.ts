import {
  TIMEZONE,
  vnDateOnly,
  vnMonthKey,
  vnMonthStart,
  vnNextMonthStart,
} from './care-time.util';

/** Bản gốc trước khi tối ưu (tạo Intl.DateTimeFormat mỗi lần gọi) — dùng để đối chiếu. */
function legacyVnDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

describe('care-time.util (tối ưu 2026-10-30: dùng chung 1 bộ định dạng)', () => {
  const sampleTimes: Date[] = [];
  // Quét mỗi 37 phút trong 3 năm: phủ ranh giới ngày/tháng/năm giờ VN (UTC+7).
  for (
    let t = Date.UTC(2025, 11, 25);
    t < Date.UTC(2028, 0, 5);
    t += 37 * 60 * 1000
  ) {
    sampleTimes.push(new Date(t));
  }

  it('vnDateOnly khớp bản gốc ở mọi mốc mẫu', () => {
    for (const d of sampleTimes) {
      expect(vnDateOnly(d)).toBe(legacyVnDateOnly(d));
    }
  });

  it('đúng ranh giới nửa đêm giờ VN (17:00 UTC)', () => {
    expect(vnDateOnly(new Date('2026-10-30T16:59:59.999Z'))).toBe('2026-10-30');
    expect(vnDateOnly(new Date('2026-10-30T17:00:00.000Z'))).toBe('2026-10-31');
  });

  it('tháng/năm: cuối tháng, cuối năm', () => {
    expect(vnMonthKey(new Date('2026-12-31T17:00:00.000Z'))).toBe('2027-01');
    expect(
      vnMonthStart(new Date('2026-10-30T10:00:00.000Z')).toISOString(),
    ).toBe('2026-09-30T17:00:00.000Z');
    expect(
      vnNextMonthStart(new Date('2026-12-15T00:00:00.000Z')).toISOString(),
    ).toBe('2026-12-31T17:00:00.000Z');
  });
});

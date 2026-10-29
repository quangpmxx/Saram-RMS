import { dailyOccurrences } from './calendar.service';

/** Giờ Việt Nam cho dễ đọc: vn('2026-10-15 09:00'). */
const vn = (s: string) => new Date(`${s.replace(' ', 'T')}:00.000+07:00`);
const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

describe('dailyOccurrences — lịch gọi lại "Mỗi ngày"', () => {
  it('trải mỗi ngày cùng giờ trong khoảng xem', () => {
    const start = vn('2026-10-28 09:30');
    expect(
      iso(
        dailyOccurrences(start, vn('2026-10-29 00:00'), vn('2026-10-31 23:59')),
      ),
    ).toEqual(
      iso([
        vn('2026-10-29 09:30'),
        vn('2026-10-30 09:30'),
        vn('2026-10-31 09:30'),
      ]),
    );
  });

  it('không có lần nào trước ngày bắt đầu', () => {
    const start = vn('2026-10-30 08:00');
    expect(
      iso(
        dailyOccurrences(start, vn('2026-10-25 00:00'), vn('2026-10-31 23:59')),
      ),
    ).toEqual(iso([vn('2026-10-30 08:00'), vn('2026-10-31 08:00')]));
  });

  it('khoảng xem kết thúc trước ngày bắt đầu → không có lần nào', () => {
    expect(
      dailyOccurrences(
        vn('2026-11-05 08:00'),
        vn('2026-10-01 00:00'),
        vn('2026-10-31 23:59'),
      ),
    ).toEqual([]);
  });

  it('khoảng rất dài bị chặn số lần', () => {
    expect(
      dailyOccurrences(
        vn('2020-01-01 08:00'),
        vn('2020-01-01 00:00'),
        vn('2030-01-01 00:00'),
      ),
    ).toHaveLength(400);
  });
});

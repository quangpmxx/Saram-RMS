import {
  AssignmentRow,
  NoteIndex,
  NoteRow,
  computeAssignmentRange,
  computeSaleDaily,
  computeSaleMonthly,
  isAssignmentAliveAt,
  pickRandomAssignments,
  rate,
  summarizeLeadMonth,
  wasCareStoppedAt,
} from './care-metrics';
import { vnDayRange, vnMonthRange } from './care-time.util';

/** Giờ Việt Nam cho dễ đọc: vn('2026-10-15 09:00'). */
const vn = (s: string) => new Date(`${s.replace(' ', 'T')}:00.000+07:00`);

const SALE_A = 'sale-a';
const SALE_B = 'sale-b';

let seq = 0;
function asg(
  leadId: string,
  assigneeId: string,
  assignedAt: string,
  endedAt: string | null = null,
): AssignmentRow {
  return {
    id: `a${++seq}`,
    leadId,
    assigneeId,
    assignedAt: vn(assignedAt),
    endedAt: endedAt ? vn(endedAt) : null,
  };
}
const note = (leadId: string, by: string, at: string): NoteRow => ({
  leadId,
  createdById: by,
  createdAt: vn(at),
});

describe('care-time.util', () => {
  it('ngày/tháng theo giờ Việt Nam', () => {
    expect(vnDayRange('2026-10-28').start.toISOString()).toBe(
      '2026-10-27T17:00:00.000Z',
    );
    const dec = vnMonthRange('2026-12');
    expect(dec.end.toISOString()).toBe('2026-12-31T17:00:00.000Z');
  });
});

describe('lượt giao hết hạn khi sang tháng mới', () => {
  it('còn hiệu lực tới 23:59 ngày cuối tháng, hết hiệu lực từ 00:00 ngày 1', () => {
    const a = asg('L1', SALE_A, '2026-10-20 10:00');
    expect(isAssignmentAliveAt(a, vn('2026-10-31 23:59'))).toBe(true);
    expect(isAssignmentAliveAt(a, vn('2026-11-01 00:00'))).toBe(false);
  });
});

describe('computeSaleDaily', () => {
  const day = vnDayRange('2026-10-15');
  const endOfDay = vn('2026-10-15 23:59');

  it('đếm data khác nhau: 3 ghi chú trên 1 data = 1 đã xử lý, 3 lượt chăm sóc', () => {
    const assignments = [
      asg('L1', SALE_A, '2026-10-15 08:00'),
      asg('L2', SALE_A, '2026-10-15 08:00'),
    ];
    const notes = new NoteIndex([
      note('L1', SALE_A, '2026-10-15 09:00'),
      note('L1', SALE_A, '2026-10-15 10:00'),
      note('L1', SALE_A, '2026-10-15 11:00'),
    ]);
    const m = computeSaleDaily(
      assignments,
      notes,
      day.start,
      day.end,
      endOfDay,
    );
    expect(m.today).toEqual({ assigned: 2, processed: 1, pending: 1 });
    expect(m.completion_rate).toBe(50);
    expect(m.care_turns).toBe(3);
  });

  it('ghi chú của người khác KHÔNG tính là Sale được giao đã xử lý', () => {
    const notes = new NoteIndex([note('L1', 'leader', '2026-10-15 09:00')]);
    const m = computeSaleDaily(
      [asg('L1', SALE_A, '2026-10-15 08:00')],
      notes,
      day.start,
      day.end,
      endOfDay,
    );
    expect(m.today.processed).toBe(0);
    expect(m.today.pending).toBe(1);
  });

  it('ghi chú TRƯỚC lúc giao không tính', () => {
    const notes = new NoteIndex([note('L1', SALE_A, '2026-10-15 07:00')]);
    const m = computeSaleDaily(
      [asg('L1', SALE_A, '2026-10-15 08:00')],
      notes,
      day.start,
      day.end,
      endOfDay,
    );
    expect(m.today.processed).toBe(0);
  });

  it('data giao hôm trước chưa xử lý vào "Tồn cũ", tách khỏi "Trong ngày"', () => {
    const assignments = [
      asg('OLD1', SALE_A, '2026-10-13 08:00'),
      asg('OLD2', SALE_A, '2026-10-14 08:00'),
      asg('DONE', SALE_A, '2026-10-14 08:00'),
      asg('NEW', SALE_A, '2026-10-15 08:00'),
    ];
    const notes = new NoteIndex([
      note('DONE', SALE_A, '2026-10-14 09:00'), // xử lý xong từ hôm qua
      note('OLD1', SALE_A, '2026-10-15 09:00'), // tồn cũ xử lý hôm nay
    ]);
    const m = computeSaleDaily(
      assignments,
      notes,
      day.start,
      day.end,
      endOfDay,
    );
    expect(m.today).toEqual({ assigned: 1, processed: 0, pending: 1 });
    expect(m.completion_rate).toBe(0);
    expect(m.backlog).toEqual({ start: 2, processed: 1, remaining: 1 });
  });

  it('lượt bị thu hồi mà chưa xử lý không tính cho Sale cũ', () => {
    const assignments = [
      asg('L1', SALE_A, '2026-10-15 08:00', '2026-10-15 09:00'),
    ];
    const m = computeSaleDaily(
      assignments,
      new NoteIndex([]),
      day.start,
      day.end,
      endOfDay,
    );
    expect(m.today.assigned).toBe(0);
    expect(m.completion_rate).toBeNull();
  });

  it('lượt đã xử lý rồi mới bị giao lại vẫn tính là đã xử lý cho Sale cũ', () => {
    const assignments = [
      asg('L1', SALE_A, '2026-10-15 08:00', '2026-10-15 10:00'),
    ];
    const notes = new NoteIndex([note('L1', SALE_A, '2026-10-15 09:00')]);
    const m = computeSaleDaily(
      assignments,
      notes,
      day.start,
      day.end,
      endOfDay,
    );
    expect(m.today).toEqual({ assigned: 1, processed: 1, pending: 0 });
  });

  it('dòng tổng: giao lại A → B trong ngày chỉ tính 1 data', () => {
    const assignments = [
      asg('L1', SALE_A, '2026-10-15 08:00', '2026-10-15 10:00'),
      asg('L1', SALE_B, '2026-10-15 10:00'),
    ];
    const notes = new NoteIndex([note('L1', SALE_A, '2026-10-15 09:00')]);
    const m = computeSaleDaily(
      assignments,
      notes,
      day.start,
      day.end,
      endOfDay,
    );
    expect(m.today.assigned).toBe(1);
  });

  it('không chia cho 0', () => {
    const m = computeSaleDaily(
      [],
      new NoteIndex([]),
      day.start,
      day.end,
      endOfDay,
    );
    expect(m.completion_rate).toBeNull();
    expect(rate(0, 0)).toBeNull();
  });

  it('ngày cuối tháng: data chưa xử lý vẫn là "chưa xử lý"; sang ngày 1 thì hết tồn', () => {
    const a = asg('L1', SALE_A, '2026-10-31 08:00');
    const oct31 = vnDayRange('2026-10-31');
    const m31 = computeSaleDaily(
      [a],
      new NoteIndex([]),
      oct31.start,
      oct31.end,
      vn('2026-11-02 10:00'),
    );
    expect(m31.today.pending).toBe(1);
    const nov1 = vnDayRange('2026-11-01');
    const m1 = computeSaleDaily(
      [a],
      new NoteIndex([]),
      nov1.start,
      nov1.end,
      vn('2026-11-02 10:00'),
    );
    expect(m1.backlog.start).toBe(0);
  });
});

describe('computeAssignmentRange — thống kê đầu Kho theo khoảng ngày', () => {
  const from = vn('2026-10-10 00:00');
  const to = vn('2026-10-21 00:00');
  const now = vn('2026-10-29 12:00');

  it('đếm data giao trong khoảng, đã xử lý = Sale được giao đã ghi chú', () => {
    const assignments = [
      asg('L1', SALE_A, '2026-10-12 09:00'),
      asg('L2', SALE_A, '2026-10-15 09:00'),
      asg('L3', SALE_B, '2026-10-20 09:00'),
      asg('L4', SALE_A, '2026-10-05 09:00'), // trước khoảng
      asg('L5', SALE_A, '2026-10-22 09:00'), // sau khoảng
    ];
    const notes = new NoteIndex([
      note('L1', SALE_A, '2026-10-12 10:00'),
      note('L2', SALE_B, '2026-10-15 10:00'), // người khác ghi chú → chưa xử lý
      note('L3', SALE_B, '2026-10-25 10:00'), // xử lý sau khoảng → chưa xử lý
    ]);
    expect(computeAssignmentRange(assignments, notes, from, to, now)).toEqual({
      assigned: 3,
      processed: 1,
      pending: 2,
    });
  });

  it('1 data giao 2 lần chỉ đếm 1; lượt bị thu hồi chưa xử lý không tính', () => {
    const assignments = [
      asg('L1', SALE_A, '2026-10-12 09:00', '2026-10-13 09:00'),
      asg('L1', SALE_B, '2026-10-13 09:00'),
      asg('L2', SALE_A, '2026-10-14 09:00', '2026-10-15 09:00'),
    ];
    const notes = new NoteIndex([note('L1', SALE_B, '2026-10-14 09:00')]);
    expect(computeAssignmentRange(assignments, notes, from, to, now)).toEqual({
      assigned: 1,
      processed: 1,
      pending: 0,
    });
  });
});

describe('computeSaleMonthly', () => {
  const oct = vnMonthRange('2026-10');

  it('được giao / đã chăm sóc / chưa chăm sóc theo data khác nhau', () => {
    const assignments = [
      asg('L1', SALE_A, '2026-10-02 08:00'),
      asg('L2', SALE_A, '2026-10-03 08:00'),
      asg('L3', SALE_A, '2026-10-04 08:00', '2026-10-05 08:00'), // thu hồi
    ];
    const notes = new NoteIndex([
      note('L1', SALE_A, '2026-10-02 09:00'),
      note('L1', SALE_A, '2026-10-20 09:00'),
    ]);
    const m = computeSaleMonthly(
      assignments,
      notes,
      oct.start,
      oct.end,
      vn('2026-10-25 12:00'),
    );
    expect(m.assigned).toBe(3);
    expect(m.processed).toBe(1);
    expect(m.pending).toBe(1); // L2 (L3 đã bị thu hồi)
    expect(m.care_turns).toBe(2);
    expect(m.last_care_at).toEqual(vn('2026-10-20 09:00'));
  });

  it('sang tháng mới bắt đầu lại, lịch sử tháng cũ không đổi', () => {
    const assignments = [asg('L1', SALE_A, '2026-10-02 08:00')];
    const nov = vnMonthRange('2026-11');
    const now = vn('2026-11-05 12:00');
    expect(
      computeSaleMonthly(
        assignments,
        new NoteIndex([]),
        nov.start,
        nov.end,
        now,
      ).assigned,
    ).toBe(0);
    expect(
      computeSaleMonthly(
        assignments,
        new NoteIndex([]),
        oct.start,
        oct.end,
        now,
      ),
    ).toMatchObject({ assigned: 1, pending: 1 });
  });
});

describe('summarizeLeadMonth — trạng thái và mức ưu tiên giao ngẫu nhiên', () => {
  const monthStart = vnMonthRange('2026-10').start;
  const now = vn('2026-10-15 12:00');

  it('mức 1: chưa chăm sóc, chưa từng được giao trong tháng', () => {
    const s = summarizeLeadMonth('L1', [], new NoteIndex([]), monthStart, now);
    expect(s).toMatchObject({ month_status: 'not_cared', random_priority: 1 });
  });

  it('mức 2: từng được giao nhưng lượt đã đóng, chưa chăm sóc', () => {
    const s = summarizeLeadMonth(
      'L1',
      [asg('L1', SALE_A, '2026-10-05 08:00', '2026-10-06 08:00')],
      new NoteIndex([]),
      monthStart,
      now,
    );
    expect(s.random_priority).toBe(2);
    expect(s.open_assignment).toBeNull();
  });

  it('mức 3: đã chăm sóc trong tháng (ghi chú của bất kỳ ai)', () => {
    const s = summarizeLeadMonth(
      'L1',
      [],
      new NoteIndex([note('L1', 'leader', '2026-10-10 08:00')]),
      monthStart,
      now,
    );
    expect(s).toMatchObject({ month_status: 'cared', random_priority: 3 });
  });

  it('đang giao cho Sale khác chưa xử lý → bị loại khỏi giao ngẫu nhiên', () => {
    const s = summarizeLeadMonth(
      'L1',
      [asg('L1', SALE_A, '2026-10-14 08:00')],
      new NoteIndex([]),
      monthStart,
      now,
    );
    expect(s.assigned_pending).toBe(true);
    expect(s.random_priority).toBeNull();
  });

  it('chăm sóc từ tháng trước không tính cho tháng này', () => {
    const s = summarizeLeadMonth(
      'L1',
      [],
      new NoteIndex([note('L1', SALE_A, '2026-09-30 22:00')]),
      monthStart,
      now,
    );
    expect(s.month_status).toBe('not_cared');
  });
});

describe('wasCareStoppedAt — dựng lại trạng thái Dừng chăm sóc từ nhật ký', () => {
  const logs = [
    { createdAt: vn('2026-10-05 08:00'), newValue: '2026-10-05T01:00:00.000Z' },
    { createdAt: vn('2026-11-05 08:00'), newValue: null },
  ];
  it('trạng thái tại từng mốc', () => {
    expect(wasCareStoppedAt(logs, vn('2026-10-01 00:00'))).toBe(false);
    expect(wasCareStoppedAt(logs, vn('2026-11-01 00:00'))).toBe(true);
    expect(wasCareStoppedAt(logs, vn('2026-12-01 00:00'))).toBe(false);
    expect(wasCareStoppedAt([], vn('2026-12-01 00:00'))).toBe(false);
  });
});

describe('pickRandomAssignments', () => {
  const noShuffle = () => 0.999;

  it('ưu tiên 1 → 2 → 3, chia vòng đều, không trùng data', () => {
    const candidates = [
      { leadId: 'P3a', teamId: 'T', priority: 3 as const },
      { leadId: 'P1a', teamId: 'T', priority: 1 as const },
      { leadId: 'P2a', teamId: 'T', priority: 2 as const },
      { leadId: 'P1b', teamId: 'T', priority: 1 as const },
      { leadId: 'P3b', teamId: 'T', priority: 3 as const },
    ];
    const picks = pickRandomAssignments(
      candidates,
      [
        { id: SALE_A, teamId: 'T', quota: 2 },
        { id: SALE_B, teamId: 'T', quota: 2 },
      ],
      noShuffle,
    );
    expect(picks).toHaveLength(4);
    expect(new Set(picks.map((p) => p.leadId)).size).toBe(4);
    expect(picks.map((p) => p.priority).sort()).toEqual([1, 1, 2, 3]);
    expect(picks.filter((p) => p.assigneeId === SALE_A)).toHaveLength(2);
    expect(picks.filter((p) => p.assigneeId === SALE_B)).toHaveLength(2);
  });

  it('thiếu data → trả về đúng số thực tế', () => {
    const picks = pickRandomAssignments(
      [{ leadId: 'L1', teamId: 'T', priority: 1 }],
      [
        { id: SALE_A, teamId: 'T', quota: 5 },
        { id: SALE_B, teamId: 'T', quota: 5 },
      ],
    );
    expect(picks).toHaveLength(1);
  });

  it('chỉ giao data cùng nhóm với Sale', () => {
    const picks = pickRandomAssignments(
      [
        { leadId: 'X1', teamId: 'TX', priority: 1 },
        { leadId: 'Y1', teamId: 'TY', priority: 1 },
      ],
      [{ id: SALE_A, teamId: 'TX', quota: 5 }],
    );
    expect(picks.map((p) => p.leadId)).toEqual(['X1']);
  });
});

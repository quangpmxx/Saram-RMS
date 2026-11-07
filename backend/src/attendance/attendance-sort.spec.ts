import { sortForAttendance } from './attendance.service';

describe('sortForAttendance — thứ tự bảng chấm công (2026-11-07)', () => {
  it('Quản lý → MKT → nhóm A (Leader, Sup Leader, NV) → nhóm B → chưa có nhóm', () => {
    const A = { name: 'Nhóm A' };
    const B = { name: 'Nhóm B' };
    const rows = [
      { fullName: 'Sale B', role: 'sale' as const, team: B },
      { fullName: 'Leader B', role: 'leader' as const, team: B },
      { fullName: 'Không nhóm', role: 'sale' as const, team: null },
      { fullName: 'Sale A2', role: 'sale' as const, team: A },
      { fullName: 'Sup A', role: 'sup_leader' as const, team: A },
      { fullName: 'MKT 1', role: 'mkt' as const, team: null },
      { fullName: 'Sale A1', role: 'sale' as const, team: A },
      { fullName: 'Leader A', role: 'leader' as const, team: A },
      { fullName: 'Quản lý', role: 'manager' as const, team: null },
      { fullName: 'Sup B', role: 'sup_leader' as const, team: B },
    ];
    expect(sortForAttendance(rows).map((r) => r.fullName)).toEqual([
      'Quản lý',
      'MKT 1',
      'Leader A',
      'Sup A',
      'Sale A1',
      'Sale A2',
      'Leader B',
      'Sup B',
      'Sale B',
      'Không nhóm',
    ]);
  });
});

import {
  CAPABILITY_CATALOG,
  can,
  canSeeAllTeams,
  effectiveCapabilities,
} from './capability-catalog';

describe('capability-catalog (phân quyền chi tiết)', () => {
  it('mã quyền không trùng', () => {
    const codes = CAPABILITY_CATALOG.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('mặc định theo vai trò', () => {
    expect(can({ role: 'sale' }, 'lead.claim')).toBe(true);
    expect(can({ role: 'sale' }, 'lead.assign')).toBe(false);
    expect(can({ role: 'leader' }, 'dashboard.perf_team')).toBe(true);
    expect(can({ role: 'mkt' }, 'lead.delete')).toBe(true);
  });

  it('cho phép / không cho phép riêng ghi đè vai trò', () => {
    const sale = {
      role: 'sale' as const,
      capabilityOverrides: {
        'dashboard.perf_team': true,
        'lead.claim': false,
      },
    };
    expect(can(sale, 'dashboard.perf_team')).toBe(true);
    expect(can(sale, 'lead.claim')).toBe(false);
  });

  it('Admin có mọi quyền trừ việc chỉ dành cho nhân viên, override không tác dụng', () => {
    const admin = {
      role: 'admin' as const,
      capabilityOverrides: { 'lead.delete': false },
    };
    expect(can(admin, 'lead.delete')).toBe(true);
    expect(can(admin, 'report.submit')).toBe(false);
    expect(can(admin, 'leave.create')).toBe(false);
  });

  it('mã quyền sai → false', () => {
    expect(can({ role: 'manager' }, 'khong.ton.tai')).toBe(false);
  });

  it('effectiveCapabilities chỉ gồm quyền có hiệu lực', () => {
    const caps = effectiveCapabilities({ role: 'sale' });
    expect(caps).toContain('lead.hold');
    expect(caps).not.toContain('lead.delete');
  });

  it('canSeeAllTeams: Sale có 1 quyền toàn công ty thì xem được mọi nhóm', () => {
    expect(canSeeAllTeams({ role: 'sale' })).toBe(false);
    expect(
      canSeeAllTeams({
        role: 'sale',
        capabilityOverrides: { 'dashboard.filter_all': true },
      }),
    ).toBe(true);
  });
});

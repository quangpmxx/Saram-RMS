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

  describe('rà soát 2026-11-20: quyền theo vai trò dùng được', () => {
    it('vai trò mặc định luôn nằm trong vai trò dùng được; quyền cần kèm có sẵn với vai trò mặc định', () => {
      for (const c of CAPABILITY_CATALOG) {
        for (const role of c.defaultRoles) {
          if (c.applicableRoles) expect(c.applicableRoles).toContain(role);
          for (const req of c.requires ?? [])
            expect([c.code, req, can({ role }, req)]).toEqual([
              c.code,
              req,
              true,
            ]);
        }
      }
    });

    it('người làm theo nhóm không bao giờ có quyền data toàn công ty, kể cả chỉnh riêng cũ', () => {
      for (const code of [
        'lead.view_all',
        'lead.manage_all_teams',
        'care.view_all',
        'calendar.view_all',
      ]) {
        expect(
          can({ role: 'sale', capabilityOverrides: { [code]: true } }, code),
        ).toBe(false);
        expect(
          can({ role: 'leader', capabilityOverrides: { [code]: true } }, code),
        ).toBe(false);
      }
      // Trang không phải data lao động vẫn cấp được (user duyệt).
      expect(
        can(
          {
            role: 'leader',
            capabilityOverrides: { 'attendance.view_all': true },
          },
          'attendance.view_all',
        ),
      ).toBe(true);
    });

    it('quyền "nhóm mình" không áp cho người không thuộc nhóm', () => {
      expect(
        can(
          { role: 'mkt', capabilityOverrides: { 'lead.view_team': true } },
          'lead.view_team',
        ),
      ).toBe(false);
      expect(
        can(
          { role: 'mkt', capabilityOverrides: { 'report.submit': true } },
          'report.submit',
        ),
      ).toBe(false);
    });

    it('Leader được bật nhận data thì mặc định giữ số được; tắt riêng vẫn tắt được', () => {
      expect(can({ role: 'leader' }, 'lead.hold')).toBe(false);
      expect(
        can(
          { role: 'leader', capabilityOverrides: { 'lead.claim': true } },
          'lead.hold',
        ),
      ).toBe(true);
      expect(
        can(
          {
            role: 'leader',
            capabilityOverrides: { 'lead.claim': true, 'lead.hold': false },
          },
          'lead.hold',
        ),
      ).toBe(false);
    });
  });
});

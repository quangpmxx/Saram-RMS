import { evaluateFormula } from './formula';
import { PAYROLL_VARIABLES } from './payroll.service';
import { DEFAULT_COMPONENTS } from './payroll-presets';

/** Bộ thành phần mặc định (mẫu phiếu lương Saram): công thức chạy được, mã không trùng. */
describe('Thành phần lương mặc định', () => {
  const scope: Record<string, number> = {};
  for (const v of PAYROLL_VARIABLES) scope[v.code] = 1;

  it('công thức hợp lệ, mã không trùng', () => {
    for (const c of DEFAULT_COMPONENTS) {
      if (c.formula)
        expect(() => evaluateFormula(c.formula!, scope)).not.toThrow();
    }
    expect(new Set(DEFAULT_COMPONENTS.map((c) => c.code)).size).toBe(
      DEFAULT_COMPONENTS.length,
    );
  });

  it('khớp phiếu lương mẫu: tiền ăn tối đa bằng công chuẩn, doanh số theo đầu người khi có mức riêng', () => {
    const f = (code: string) =>
      DEFAULT_COMPONENTS.find((c) => c.code === code)!.formula!;
    expect(
      evaluateFormula(f('TIEN_AN'), { CONG_THUC_TE: 31, CONG_CHUAN: 27 }),
    ).toBe(810000);
    expect(
      evaluateFormula(f('DOANH_SO'), {
        MUC_HOA_HONG: 50000,
        SO_LAO_DONG: 4,
        HOA_HONG_GIO: 999,
      }),
    ).toBe(200000);
    expect(
      evaluateFormula(f('DOANH_SO'), {
        MUC_HOA_HONG: 0,
        SO_LAO_DONG: 4,
        HOA_HONG_GIO: 860000,
      }),
    ).toBe(860000);
  });
});

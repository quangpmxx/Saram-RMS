import { evaluateFormula, FormulaError } from './formula';

describe('evaluateFormula', () => {
  const scope = {
    LUONG_CO_BAN: 7800000,
    CONG_CHUAN: 26,
    CONG_HUONG_LUONG: 13,
    SO_LAO_DONG: 4,
  };

  it('tính lương theo công', () => {
    expect(
      evaluateFormula('=LUONG_CO_BAN / CONG_CHUAN * CONG_HUONG_LUONG', scope),
    ).toBe(3900000);
  });
  it('ưu tiên phép tính, ngoặc, số âm', () => {
    expect(evaluateFormula('2 + 3 * (4 - 1) - -1', {})).toBe(12);
  });
  it('IF + so sánh + hàm', () => {
    expect(
      evaluateFormula('IF(SO_LAO_DONG >= 4, SO_LAO_DONG * 50000, 0)', scope),
    ).toBe(200000);
    expect(evaluateFormula('IF(SO_LAO_DONG > 4; 1; 2)', scope)).toBe(2);
    expect(
      evaluateFormula(
        'MAX(1, 5, 3) + MIN(4, 2) + SUM(1, 2) + ROUND(1234.5, -2)',
        {},
      ),
    ).toBe(1210);
  });
  it('chia cho 0 trả 0', () => {
    expect(evaluateFormula('100 / 0', {})).toBe(0);
  });
  it('báo lỗi khi thiếu biến hoặc sai cú pháp', () => {
    expect(() => evaluateFormula('KHONG_CO * 2', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('(1 + 2', {})).toThrow(FormulaError);
    expect(() => evaluateFormula('1 2', {})).toThrow(FormulaError);
  });
});

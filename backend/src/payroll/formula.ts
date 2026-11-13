/**
 * Bộ tính công thức lương kiểu Excel (2026-11-13) — KHÔNG dùng eval.
 * Hỗ trợ: số, biến (chữ in hoa + gạch dưới), + - * /, ngoặc, so sánh
 * (> < >= <= = <>), hàm IF, SUM, MIN, MAX, ROUND, ABS. Dấu "=" đầu công thức được bỏ qua.
 * Chia cho 0 trả 0 (tháng chưa có công chuẩn không làm hỏng cả bảng lương).
 */
export class FormulaError extends Error {}

type Token =
  { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

const FUNCTIONS = new Set(['IF', 'SUM', 'MIN', 'MAX', 'ROUND', 'ABS']);

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const v = Number(src.slice(i, j));
      if (Number.isNaN(v))
        throw new FormulaError(`Số không hợp lệ: ${src.slice(i, j)}`);
      out.push({ t: 'num', v });
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j).toUpperCase() });
      i = j;
    } else {
      const two = src.slice(i, i + 2);
      if (two === '>=' || two === '<=' || two === '<>') {
        out.push({ t: 'op', v: two });
        i += 2;
      } else if ('+-*/(),;<>='.includes(c)) {
        // ";" = dấu ngăn tham số kiểu Excel tiếng Việt, coi như ","
        out.push({ t: 'op', v: c === ';' ? ',' : c });
        i++;
      } else {
        throw new FormulaError(`Ký tự không hợp lệ: ${c}`);
      }
    }
  }
  return out;
}

/** Tính 1 công thức với bảng biến `scope`. Ném FormulaError nếu sai cú pháp / thiếu biến. */
export function evaluateFormula(
  formula: string,
  scope: Record<string, number>,
): number {
  const tokens = tokenize(formula.trim().replace(/^=/, ''));
  if (tokens.length === 0) return 0;
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek().v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`Thiếu "${v}"`);
    pos++;
  };

  function comparison(): number {
    const left = additive();
    const tk = peek();
    if (tk?.t === 'op' && ['>', '<', '>=', '<=', '=', '<>'].includes(tk.v)) {
      pos++;
      const right = additive();
      const ok =
        tk.v === '>'
          ? left > right
          : tk.v === '<'
            ? left < right
            : tk.v === '>='
              ? left >= right
              : tk.v === '<='
                ? left <= right
                : tk.v === '='
                  ? left === right
                  : left !== right;
      return ok ? 1 : 0;
    }
    return left;
  }
  function additive(): number {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = unary();
    while (isOp('*') || isOp('/')) {
      const op = tokens[pos++].v;
      const r = unary();
      v = op === '*' ? v * r : r === 0 ? 0 : v / r;
    }
    return v;
  }
  function unary(): number {
    if (isOp('-')) {
      pos++;
      return -unary();
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return primary();
  }
  function primary(): number {
    const tk = tokens[pos++];
    if (!tk) throw new FormulaError('Công thức chưa viết xong');
    if (tk.t === 'num') return tk.v;
    if (tk.t === 'op' && tk.v === '(') {
      const v = comparison();
      expect(')');
      return v;
    }
    if (tk.t === 'id') {
      if (isOp('(')) {
        if (!FUNCTIONS.has(tk.v))
          throw new FormulaError(`Không có hàm ${tk.v}`);
        pos++;
        const args: number[] = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(',')) {
            pos++;
            args.push(comparison());
          }
        }
        expect(')');
        return callFunction(tk.v, args);
      }
      if (!(tk.v in scope)) throw new FormulaError(`Không có biến ${tk.v}`);
      return scope[tk.v];
    }
    throw new FormulaError(`Sai cú pháp gần "${tk.v}"`);
  }

  const result = comparison();
  if (pos < tokens.length)
    throw new FormulaError(`Sai cú pháp gần "${tokens[pos].v}"`);
  if (!Number.isFinite(result)) throw new FormulaError('Kết quả không hợp lệ');
  return result;
}

function callFunction(name: string, a: number[]): number {
  switch (name) {
    case 'IF':
      if (a.length < 2) throw new FormulaError('IF cần ít nhất 2 tham số');
      return a[0] !== 0 ? a[1] : (a[2] ?? 0);
    case 'SUM':
      return a.reduce((s, x) => s + x, 0);
    case 'MIN':
      return a.length ? Math.min(...a) : 0;
    case 'MAX':
      return a.length ? Math.max(...a) : 0;
    case 'ABS':
      return Math.abs(a[0] ?? 0);
    default: {
      // ROUND(x, n): n âm làm tròn tới hàng chục/trăm/nghìn như Excel
      const f = 10 ** (a[1] ?? 0);
      return Math.round((a[0] ?? 0) * f) / f;
    }
  }
}

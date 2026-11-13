import { PayrollService } from './payroll.service';

/** Xem trước mẫu: tính phiếu bằng số liệu minh hoạ, không ghi gì vào DB. */
describe('PayrollService.previewTemplate', () => {
  it('nhân viên mẫu: tính đủ các khoản, thực nhận = (1) − (2), khoản nhập tay đánh dấu manual', async () => {
    const components = [
      {
        code: 'LUONG_CHINH_THUC',
        name: 'Lương chính thức 100%',
        nature: 'income',
        formula: 'LUONG_CO_BAN / CONG_CHUAN * CONG_CHINH_THUC',
        showOnPayslip: true,
      },
      {
        code: 'PC_DIEN_THOAI',
        name: 'Phụ cấp điện thoại',
        nature: 'allowance',
        formula: '0',
        showOnPayslip: true,
      },
      {
        code: 'UNG_LUONG',
        name: 'Ứng lương',
        nature: 'deduction',
        formula: null,
        showOnPayslip: true,
      },
    ];
    const prisma: any = {
      payrollComponent: { findMany: jest.fn().mockResolvedValue(components) },
      payrollSlip: { create: jest.fn(), update: jest.fn() },
    };
    const r = await new PayrollService(prisma).previewTemplate(
      components.map((c) => ({ code: c.code })),
    );
    const v = Object.fromEntries(r.slip.lines.map((l) => [l.code, l.value]));
    // Công hưởng lương = công chuẩn → lương chính thức = đúng lương cơ bản mẫu.
    expect(v).toEqual({
      LUONG_CHINH_THUC: 8000000,
      PC_DIEN_THOAI: 500000,
      UNG_LUONG: 1000000,
    });
    expect(r.slip.net_pay).toBe(7500000);
    expect(r.slip.lines.find((l) => l.code === 'UNG_LUONG')?.manual).toBe(true);
    expect(r.sample_data).toBe(true);
    expect(prisma.payrollSlip.create).not.toHaveBeenCalled();
  });
});

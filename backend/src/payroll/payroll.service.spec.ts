import { PayrollService } from './payroll.service';

/**
 * Kiểm phép tính compute() theo mẫu phiếu lương Saram, Prisma giả.
 * Tháng 11/2026: 30 ngày, 5 Chủ nhật → công chuẩn 25.
 */
const day = (d: number) => new Date(Date.UTC(2026, 10, d));

describe('PayrollService.compute', () => {
  function build(opts: { setting?: object; oldSlips?: object[] } = {}) {
    const created: any[] = [];
    const updated: any[] = [];
    const components = [
      {
        code: 'LUONG_THU_VIEC',
        name: 'Lương thử việc 85%',
        nature: 'income',
        formula: 'LUONG_CO_BAN * 0.85 / CONG_CHUAN * CONG_THU_VIEC',
        showOnPayslip: true,
      },
      {
        code: 'LUONG_CHINH_THUC',
        name: 'Lương chính thức 100%',
        nature: 'income',
        formula: 'LUONG_CO_BAN / CONG_CHUAN * CONG_CHINH_THUC',
        showOnPayslip: true,
      },
      {
        code: 'LUONG_NGAY_LE',
        name: 'Lương ngày lễ 200%',
        nature: 'income',
        formula: null,
        showOnPayslip: true,
      },
      {
        code: 'DOANH_SO',
        name: 'Doanh số',
        nature: 'income',
        formula:
          'IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_GIO)',
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
    // 20 ngày ✓, 2 ngày ½, 1 NP, 1 lễ, 1 nghỉ không phép — rải từ ngày 2.
    const statuses = [
      ...Array(20).fill('present'),
      'half',
      'half',
      'paid_leave',
      'holiday',
      'unpaid_leave',
    ];
    const attendance = statuses.map((status, i) => ({
      accountId: 'a1',
      date: day(i + 2),
      status,
    }));
    const prisma: any = {
      payroll: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          year: 2026,
          month: 11,
          status: 'draft',
        }),
      },
      payrollComponent: {
        count: jest.fn().mockResolvedValue(6),
        findMany: jest.fn().mockResolvedValue(components),
      },
      payrollTemplate: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            name: 'Phiếu lương Saram',
            roles: [],
            isDefault: true,
            items: components.map((c) => ({ code: c.code })),
          },
        ]),
      },
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            role: 'sale',
            attendanceTracked: true,
            payrollSetting: {
              baseSalary: 7500000,
              commissionRate: 0,
              templateId: null,
              overrides: {},
              officialDate: null,
              ...opts.setting,
            },
          },
        ]),
      },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue(attendance) },
      salesEntryRecord: {
        findMany: jest.fn().mockResolvedValue([
          { saleUserId: 'a1', companyId: 'c1', totalHours: 100 },
          { saleUserId: 'a1', companyId: 'c2', totalHours: 50 },
          { saleUserId: 'a1', companyId: null, totalHours: null },
        ]),
      },
      payrollCommissionRate: {
        findMany: jest.fn().mockResolvedValue([
          { companyId: 'c1', ratePerHour: 1000 },
          { companyId: 'c2', ratePerHour: 2000 },
        ]),
      },
      payrollSlip: {
        findMany: jest.fn().mockResolvedValue(opts.oldSlips ?? []),
        create: jest.fn((a) => created.push(a.data)),
        update: jest.fn((a) => updated.push(a.data)),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    return { service: new PayrollService(prisma), created, updated };
  }

  const values = (slip: any) =>
    Object.fromEntries(slip.lines.map((l: any) => [l.code, l.value]));

  it('chưa có ngày chính thức: toàn bộ công tính lương chính thức; NP + lễ vẫn hưởng lương; hoa hồng theo giờ', async () => {
    const { service, created } = build();
    await service.compute('p1');
    const slip = created[0];
    expect(slip.inputs).toMatchObject({
      CONG_CHUAN: 25,
      CONG_THUC_TE: 21,
      CONG_HUONG_LUONG: 23,
      CONG_THU_VIEC: 0,
      CONG_CHINH_THUC: 23,
      SO_LAO_DONG: 3,
      HOA_HONG_GIO: 200000,
    });
    // 7.500.000 / 25 × 23 = 6.900.000
    expect(values(slip)).toEqual({
      LUONG_THU_VIEC: 0,
      LUONG_CHINH_THUC: 6900000,
      LUONG_NGAY_LE: 0,
      DOANH_SO: 200000,
      PC_DIEN_THOAI: 0,
      UNG_LUONG: 0,
    });
    expect(slip.netPay).toBe(7100000);
  });

  it('chính thức từ ngày 12: công trước đó hưởng 85%; phụ cấp riêng từng người; khoản nhập tay; mức hoa hồng riêng → theo đầu người', async () => {
    const { service, updated } = build({
      setting: {
        officialDate: day(12),
        commissionRate: 50000,
        overrides: { PC_DIEN_THOAI: '1500000' },
      },
      oldSlips: [
        {
          id: 's1',
          accountId: 'a1',
          manualValues: { LUONG_NGAY_LE: 600000, UNG_LUONG: 2000000 },
          confirmStatus: 'confirmed',
          netPay: 1,
        },
      ],
    });
    await service.compute('p1');
    const slip = updated[0];
    // Ngày 2–11 = 10 ngày ✓ (thử việc); còn lại 10 ✓ + 2 × ½ + NP + lễ = 13 công chính thức.
    expect(slip.inputs).toMatchObject({
      CONG_THU_VIEC: 10,
      CONG_CHINH_THUC: 13,
    });
    expect(values(slip)).toEqual({
      LUONG_THU_VIEC: 2550000, // 7.500.000 × 0,85 / 25 × 10
      LUONG_CHINH_THUC: 3900000, // 7.500.000 / 25 × 13
      LUONG_NGAY_LE: 600000,
      DOANH_SO: 150000, // 3 người × 50.000
      PC_DIEN_THOAI: 1500000,
      UNG_LUONG: 2000000,
    });
    expect(slip.lines.find((l: any) => l.code === 'UNG_LUONG').manual).toBe(
      true,
    );
    expect(slip.netPay).toBe(
      2550000 + 3900000 + 600000 + 150000 + 1500000 - 2000000,
    );
    // Số đổi sau khi nhân viên đã đồng ý → phải xác nhận lại.
    expect(slip.confirmStatus).toBe('pending');
  });
});

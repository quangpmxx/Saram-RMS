import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { evaluateFormula, FormulaError } from './formula';
import { DEFAULT_COMPONENTS } from './payroll-presets';
import type {
  CreatePayrollDto,
  RespondSlipDto,
  SaveCommissionRatesDto,
  UpdateAccountSettingDto,
  UpdateSlipDto,
  UpsertComponentDto,
  UpsertTemplateDto,
} from './dto/payroll.dto';

/** Số liệu hệ thống tự lấy cho từng người mỗi tháng — dùng làm biến trong công thức. */
export const PAYROLL_VARIABLES: { code: string; label: string }[] = [
  { code: 'LUONG_CO_BAN', label: 'Lương cơ bản của người đó' },
  { code: 'MUC_HOA_HONG', label: 'Mức hoa hồng riêng của người đó' },
  {
    code: 'CONG_CHUAN',
    label: 'Công chuẩn = số ngày trong tháng trừ Chủ nhật',
  },
  { code: 'CONG_THUC_TE', label: 'Công đi làm thật (✓ = 1, ½ = 0,5)' },
  { code: 'NGAY_NGHI_PHEP', label: 'Số ngày nghỉ phép (NP)' },
  { code: 'NGAY_LE', label: 'Số ngày nghỉ lễ (L)' },
  { code: 'CONG_HUONG_LUONG', label: 'Công thực tế + nghỉ phép + nghỉ lễ' },
  {
    code: 'CONG_THU_VIEC',
    label: 'Công hưởng lương trước ngày chính thức (lương thử việc)',
  },
  {
    code: 'CONG_CHINH_THUC',
    label: 'Công hưởng lương từ ngày chính thức (chưa đặt ngày = toàn bộ)',
  },
  { code: 'NGAY_NGHI_KHONG_PHEP', label: 'Số ngày nghỉ không phép (N)' },
  { code: 'NGAY_NGHI_BU', label: 'Số ngày nghỉ bù (B)' },
  {
    code: 'SO_LAO_DONG',
    label: 'Số lao động trong Nhập doanh số của người đó',
  },
  { code: 'TONG_GIO_DS', label: 'Tổng giờ trong Nhập doanh số của người đó' },
  {
    code: 'HOA_HONG_GIO',
    label: 'Tổng (giờ × mức hoa hồng theo giờ của từng công ty)',
  },
];
const RESERVED = new Set([
  ...PAYROLL_VARIABLES.map((v) => v.code),
  'IF',
  'SUM',
  'MIN',
  'MAX',
  'ROUND',
  'ABS',
]);

export interface TemplateItem {
  code: string;
  formula?: string | null;
}
export interface SlipLine {
  code: string;
  name: string;
  /** income | allowance (phụ cấp, cũng cộng vào lương) | deduction | info */
  nature: string;
  formula: string;
  value: number;
  show: boolean;
  /** Khoản không có công thức → kế toán nhập tay số tiền mỗi tháng. */
  manual?: boolean;
  error?: string;
}

const num = (d: unknown): number => Number(d ?? 0);
/** Khoản nào cộng vào Tổng lương (1). */
export const isIncome = (nature: string) =>
  nature === 'income' || nature === 'allowance';
const toDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00.000Z`) : null;
const fromDate = (d: Date | null | undefined) =>
  d ? d.toISOString().slice(0, 10) : null;

/**
 * Tính từng khoản của 1 phiếu theo thứ tự trong mẫu (khoản sau dùng được kết quả khoản
 * trước). Công thức ưu tiên: riêng người → mẫu → thành phần; không có = nhập tay.
 * Dùng chung cho tính bảng lương và xem trước mẫu.
 */
export function calcLines(
  items: TemplateItem[],
  componentByCode: Map<
    string,
    {
      code: string;
      name: string;
      nature: string;
      formula: string | null;
      showOnPayslip: boolean;
    }
  >,
  overrides: Record<string, string>,
  inputs: Record<string, number>,
  manualValues: Record<string, number>,
): { lines: SlipLine[]; net: number } {
  const scope = { ...inputs };
  const lines: SlipLine[] = [];
  let net = 0;
  for (const item of items) {
    const comp = componentByCode.get(item.code);
    if (!comp) continue;
    const formula = (
      overrides[item.code] ||
      item.formula ||
      comp.formula ||
      ''
    ).trim();
    const line: SlipLine = {
      code: comp.code,
      name: comp.name,
      nature: comp.nature,
      formula,
      value: 0,
      show: comp.showOnPayslip,
    };
    if (!formula) {
      line.manual = true;
      line.value = Math.round(num(manualValues[comp.code]));
    } else {
      try {
        // Tiền làm tròn tới đồng.
        line.value = Math.round(evaluateFormula(formula, scope));
      } catch (e) {
        line.error = e instanceof Error ? e.message : 'Lỗi công thức';
      }
    }
    scope[comp.code] = line.value;
    if (isIncome(comp.nature)) net += line.value;
    else if (comp.nature === 'deduction') net -= line.value;
    lines.push(line);
  }
  return { lines, net };
}

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Thành phần lương ────────────────────────────────────────────────────────

  /** Lần đầu mở (chưa có thành phần nào): tạo sẵn bộ thành phần + mẫu chung để dùng được ngay. */
  private async ensureDefaults(): Promise<void> {
    if ((await this.prisma.payrollComponent.count()) > 0) return;
    await this.prisma.$transaction([
      this.prisma.payrollComponent.createMany({
        data: DEFAULT_COMPONENTS.map((c, i) => ({ ...c, sortOrder: i })),
        skipDuplicates: true,
      }),
      this.prisma.payrollTemplate.create({
        data: {
          name: 'Phiếu lương Saram',
          roles: [],
          isDefault: true,
          items: DEFAULT_COMPONENTS.map((c) => ({ code: c.code })),
        },
      }),
    ]);
  }

  async listComponents() {
    await this.ensureDefaults();
    const rows = await this.prisma.payrollComponent.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      nature: c.nature,
      formula: c.formula,
      show_on_payslip: c.showOnPayslip,
      sort_order: c.sortOrder,
    }));
  }

  /** Kiểm công thức: tính thử với mọi biến = 1; sai cú pháp / biến lạ → báo lỗi dễ hiểu. */
  private async assertFormula(
    formula: string | null | undefined,
    label: string,
  ) {
    if (!formula?.trim()) return;
    const codes = await this.prisma.payrollComponent.findMany({
      select: { code: true },
    });
    const scope: Record<string, number> = {};
    for (const v of PAYROLL_VARIABLES) scope[v.code] = 1;
    for (const c of codes) scope[c.code] = 1;
    try {
      evaluateFormula(formula, scope);
    } catch (e) {
      throw new UnprocessableEntityException(
        `Công thức "${label}" chưa đúng: ${e instanceof FormulaError ? e.message : 'sai cú pháp'}`,
      );
    }
  }

  async saveComponent(id: string | null, dto: UpsertComponentDto) {
    if (RESERVED.has(dto.code)) {
      throw new UnprocessableEntityException(
        `Mã ${dto.code} đã là số liệu có sẵn của hệ thống, hãy đặt mã khác`,
      );
    }
    const dup = await this.prisma.payrollComponent.findUnique({
      where: { code: dto.code },
    });
    if (dup && dup.id !== id)
      throw new ConflictException(`Mã ${dto.code} đã tồn tại`);
    await this.assertFormula(dto.formula, dto.name);
    const data = {
      code: dto.code,
      name: dto.name.trim(),
      nature: dto.nature,
      formula: dto.formula?.trim() || null,
      showOnPayslip: dto.show_on_payslip ?? true,
      sortOrder: dto.sort_order ?? 0,
    };
    if (!id) {
      const max = await this.prisma.payrollComponent.aggregate({
        _max: { sortOrder: true },
      });
      await this.prisma.payrollComponent.create({
        data: {
          ...data,
          sortOrder: dto.sort_order ?? (max._max.sortOrder ?? 0) + 1,
        },
      });
    } else {
      const old = await this.prisma.payrollComponent.findUnique({
        where: { id },
      });
      if (!old) throw new NotFoundException('Không tìm thấy thành phần lương');
      if (old.code !== dto.code) {
        throw new UnprocessableEntityException(
          'Không đổi được mã sau khi tạo (các công thức khác đang dùng mã này)',
        );
      }
      await this.prisma.payrollComponent.update({ where: { id }, data });
    }
    return { ok: true };
  }

  async deleteComponent(id: string) {
    const c = await this.prisma.payrollComponent.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy thành phần lương');
    const templates = await this.prisma.payrollTemplate.findMany();
    const used = templates.find((t) =>
      (t.items as unknown as TemplateItem[]).some((i) => i.code === c.code),
    );
    if (used) {
      throw new ConflictException(
        `"${c.name}" đang nằm trong mẫu "${used.name}" — gỡ khỏi mẫu trước khi xoá`,
      );
    }
    await this.prisma.payrollComponent.delete({ where: { id } });
    return { ok: true };
  }

  // ── Mẫu bảng lương ──────────────────────────────────────────────────────────

  async listTemplates() {
    await this.ensureDefaults();
    const rows = await this.prisma.payrollTemplate.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      roles: t.roles,
      is_default: t.isDefault,
      items: t.items as unknown as TemplateItem[],
    }));
  }

  async saveTemplate(id: string | null, dto: UpsertTemplateDto) {
    const known = new Set(
      (
        await this.prisma.payrollComponent.findMany({ select: { code: true } })
      ).map((c) => c.code),
    );
    const items: TemplateItem[] = [];
    for (const item of dto.items) {
      if (!known.has(item.code))
        throw new UnprocessableEntityException(
          `Không có thành phần lương mã ${item.code}`,
        );
      if (items.some((i) => i.code === item.code)) continue;
      await this.assertFormula(item.formula, item.code);
      items.push({ code: item.code, formula: item.formula?.trim() || null });
    }
    // Mỗi vị trí chỉ thuộc 1 mẫu: gỡ vị trí này khỏi các mẫu khác.
    const others = await this.prisma.payrollTemplate.findMany({
      where: id ? { id: { not: id } } : {},
    });
    const data = {
      name: dto.name.trim(),
      roles: [...new Set(dto.roles)],
      isDefault: dto.is_default ?? false,
      items: items as unknown as Prisma.InputJsonValue,
    };
    await this.prisma.$transaction(async (tx) => {
      for (const o of others) {
        const roles = o.roles.filter((r) => !data.roles.includes(r));
        const isDefault = data.isDefault ? false : o.isDefault;
        if (roles.length !== o.roles.length || isDefault !== o.isDefault) {
          await tx.payrollTemplate.update({
            where: { id: o.id },
            data: { roles, isDefault },
          });
        }
      }
      if (id) await tx.payrollTemplate.update({ where: { id }, data });
      else await tx.payrollTemplate.create({ data });
    });
    return { ok: true };
  }

  /**
   * Xem trước 1 mẫu (đang sửa hoặc đã lưu) thành phiếu lương hoàn chỉnh — KHÔNG ghi gì.
   * Không chọn người: nhân viên mẫu, số liệu minh hoạ tháng này. Chọn người: lương cơ
   * bản / công thức riêng / ngày chính thức / ngân hàng của người đó, công và doanh số
   * lấy từ phiếu lương gần nhất của họ (chưa có thì dùng số minh hoạ).
   */
  async previewTemplate(
    items: TemplateItem[],
    accountId?: string,
    templateName?: string,
  ) {
    const components = await this.prisma.payrollComponent.findMany();
    const componentByCode = new Map(components.map((c) => [c.code, c]));

    const now = new Date(Date.now() + 7 * 3600_000); // giờ Việt Nam
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    let standard = 0;
    for (
      let d = new Date(Date.UTC(year, month - 1, 1));
      d.getUTCMonth() === month - 1;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      if (d.getUTCDay() !== 0) standard++;
    }
    let inputs: Record<string, number> = {
      LUONG_CO_BAN: 8_000_000,
      MUC_HOA_HONG: 0,
      CONG_CHUAN: standard,
      CONG_THUC_TE: standard - 1,
      NGAY_NGHI_PHEP: 1,
      NGAY_LE: 0,
      CONG_HUONG_LUONG: standard,
      CONG_THU_VIEC: 0,
      CONG_CHINH_THUC: standard,
      NGAY_NGHI_KHONG_PHEP: 0,
      NGAY_NGHI_BU: 0,
      SO_LAO_DONG: 6,
      TONG_GIO_DS: 1_000,
      HOA_HONG_GIO: 1_500_000,
    };
    // Nhân viên mẫu: vài phụ cấp + khoản nhập tay để phiếu xem trước có số.
    let overrides: Record<string, string> = {
      PC_DIEN_THOAI: '500000',
      PC_TRACH_NHIEM: '1000000',
      BAO_HIEM: '525000',
    };
    let manualValues: Record<string, number> = { UNG_LUONG: 1_000_000 };
    let profile = {
      full_name: 'Nguyễn Văn A (nhân viên mẫu)',
      role: 'sale',
      position: 'NV Sale',
      team_name: null as string | null,
      hire_date: `${year - 1}-07-18`,
      official_date: `${year - 1}-08-17`,
      bank_account_number: '0123456789',
      bank_name: 'VIETCOMBANK',
      bank_account_holder: 'NGUYEN VAN A',
    };
    let sample = true;

    if (accountId) {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
        select: {
          ...ACCOUNT_PROFILE.select,
          payrollSetting: true,
          payrollSlips: {
            orderBy: [
              { payroll: { year: 'desc' } },
              { payroll: { month: 'desc' } },
            ],
            take: 1,
            select: { inputs: true, manualValues: true },
          },
        },
      });
      if (!account) throw new NotFoundException('Không tìm thấy nhân viên');
      const setting = account.payrollSetting;
      const last = account.payrollSlips[0];
      if (last) {
        inputs = { ...inputs, ...(last.inputs as Record<string, number>) };
        manualValues = (last.manualValues ?? {}) as Record<string, number>;
      } else {
        manualValues = {};
      }
      inputs.LUONG_CO_BAN = num(setting?.baseSalary);
      inputs.MUC_HOA_HONG = num(setting?.commissionRate);
      overrides = (setting?.overrides ?? {}) as Record<string, string>;
      profile = {
        full_name: account.fullName,
        role: account.role,
        position: account.position ?? '',
        team_name: account.team?.name ?? null,
        hire_date: fromDate(account.hireDate) ?? '',
        official_date: fromDate(setting?.officialDate) ?? '',
        bank_account_number: account.bankAccountNumber ?? '',
        bank_name: setting?.bankName ?? '',
        bank_account_holder: setting?.bankAccountHolder ?? '',
      };
      sample = !last;
    }

    const { lines, net } = calcLines(
      items,
      componentByCode,
      overrides,
      inputs,
      manualValues,
    );
    return {
      year,
      month,
      sample_data: sample,
      slip: {
        id: 'preview',
        template_name: templateName ?? null,
        manual_values: manualValues,
        note: null,
        inputs,
        lines,
        net_pay: net,
        confirm_status: 'pending',
        question: null,
        responded_at: null,
        profile,
      },
    };
  }

  async previewSavedTemplate(id: string, accountId?: string) {
    const t = await this.prisma.payrollTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Không tìm thấy mẫu bảng lương');
    return this.previewTemplate(
      t.items as unknown as TemplateItem[],
      accountId,
      t.name,
    );
  }

  async deleteTemplate(id: string) {
    await this.prisma.$transaction([
      this.prisma.payrollAccountSetting.updateMany({
        where: { templateId: id },
        data: { templateId: null },
      }),
      this.prisma.payrollTemplate.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  // ── Mức lương từng người ────────────────────────────────────────────────────

  async listAccountSettings() {
    const accounts = await this.prisma.account.findMany({
      where: { status: 'active', deletedAt: null },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        role: true,
        position: true,
        attendanceTracked: true,
        hireDate: true,
        bankAccountNumber: true,
        team: { select: { name: true } },
        payrollSetting: true,
      },
    });
    return accounts.map((a) => ({
      account_id: a.id,
      full_name: a.fullName,
      role: a.role,
      position: a.position,
      team_name: a.team?.name ?? null,
      attendance_tracked: a.attendanceTracked,
      hire_date: fromDate(a.hireDate),
      bank_account_number: a.bankAccountNumber,
      base_salary: num(a.payrollSetting?.baseSalary),
      commission_rate: num(a.payrollSetting?.commissionRate),
      template_id: a.payrollSetting?.templateId ?? null,
      overrides: (a.payrollSetting?.overrides ?? {}) as Record<string, string>,
      official_date: fromDate(a.payrollSetting?.officialDate),
      bank_name: a.payrollSetting?.bankName ?? null,
      bank_account_holder: a.payrollSetting?.bankAccountHolder ?? null,
    }));
  }

  async saveAccountSetting(accountId: string, dto: UpdateAccountSettingDto) {
    const overrides: Record<string, string> = {};
    for (const [code, formula] of Object.entries(dto.overrides ?? {})) {
      if (typeof formula !== 'string' || !formula.trim()) continue;
      await this.assertFormula(formula, code);
      overrides[code] = formula.trim();
    }
    const data = {
      baseSalary: dto.base_salary,
      commissionRate: dto.commission_rate,
      templateId: dto.template_id ?? null,
      overrides,
      officialDate: toDate(dto.official_date),
      bankName: dto.bank_name?.trim() || null,
      bankAccountHolder: dto.bank_account_holder?.trim().toUpperCase() || null,
    };
    await this.prisma.payrollAccountSetting.upsert({
      where: { accountId },
      create: { accountId, ...data },
      update: data,
    });
    return { ok: true };
  }

  // ── Mức hoa hồng theo công ty ───────────────────────────────────────────────

  async listCommissionRates() {
    const companies = await this.prisma.orderRecord.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, commissionRate: true },
    });
    return companies.map((c) => ({
      company_id: c.id,
      company_name: c.name,
      rate_per_hour: num(c.commissionRate?.ratePerHour),
    }));
  }

  async saveCommissionRates(dto: SaveCommissionRatesDto) {
    await this.prisma.$transaction(
      dto.rates.map((r) =>
        this.prisma.payrollCommissionRate.upsert({
          where: { companyId: r.company_id },
          create: { companyId: r.company_id, ratePerHour: r.rate_per_hour },
          update: { ratePerHour: r.rate_per_hour },
        }),
      ),
    );
    return { ok: true };
  }

  // ── Bảng lương ──────────────────────────────────────────────────────────────

  async listPayrolls() {
    const rows = await this.prisma.payroll.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { slips: { select: { netPay: true, confirmStatus: true } } },
    });
    return rows.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      status: p.status,
      slip_count: p.slips.length,
      total_net_pay: p.slips.reduce((s, x) => s + num(x.netPay), 0),
      confirmed_count: p.slips.filter((s) => s.confirmStatus === 'confirmed')
        .length,
      question_count: p.slips.filter((s) => s.confirmStatus === 'question')
        .length,
    }));
  }

  async createPayroll(dto: CreatePayrollDto, user: AuthenticatedUser) {
    const exists = await this.prisma.payroll.findUnique({
      where: { year_month: { year: dto.year, month: dto.month } },
    });
    if (exists)
      throw new ConflictException(
        `Đã có bảng lương tháng ${dto.month}/${dto.year}`,
      );
    const payroll = await this.prisma.payroll.create({
      data: { year: dto.year, month: dto.month, createdById: user.id },
    });
    await this.compute(payroll.id);
    return { id: payroll.id };
  }

  private async getPayrollOrThrow(id: string) {
    const payroll = await this.prisma.payroll.findUnique({ where: { id } });
    if (!payroll) throw new NotFoundException('Không tìm thấy bảng lương');
    return payroll;
  }

  /**
   * Tính (lại) toàn bộ phiếu lương của 1 bảng lương đang NHÁP: lấy công từ bảng chấm
   * công thủ công, doanh số từ Nhập doanh số, áp mẫu theo vị trí / mẫu + công thức riêng
   * của từng người. Giữ nguyên số kế toán nhập tay (thu nhập khác, khấu trừ khác, tạm ứng).
   */
  async compute(payrollId: string) {
    const payroll = await this.getPayrollOrThrow(payrollId);
    if (payroll.status !== 'draft') {
      throw new ConflictException(
        'Bảng lương đã chốt — mở chốt trước khi tính lại',
      );
    }
    await this.ensureDefaults();
    const { year, month } = payroll;
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));
    let standardDays = 0;
    for (let d = new Date(from); d < to; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 0) standardDays++;
    }

    const [
      accounts,
      components,
      templates,
      attendance,
      sales,
      rates,
      oldSlips,
    ] = await Promise.all([
      this.prisma.account.findMany({
        where: { status: 'active', deletedAt: null },
        select: {
          id: true,
          role: true,
          attendanceTracked: true,
          payrollSetting: true,
        },
      }),
      this.prisma.payrollComponent.findMany(),
      this.prisma.payrollTemplate.findMany(),
      this.prisma.attendanceRecord.findMany({
        where: { date: { gte: from, lt: to } },
        select: { accountId: true, date: true, status: true },
      }),
      this.prisma.salesEntryRecord.findMany({
        where: {
          kind: { not: 'bonus' },
          periodYear: year,
          periodMonth: month,
          deletedAt: null,
          saleUserId: { not: null },
        },
        select: { saleUserId: true, companyId: true, totalHours: true },
      }),
      this.prisma.payrollCommissionRate.findMany(),
      this.prisma.payrollSlip.findMany({ where: { payrollId } }),
    ]);

    const componentByCode = new Map(components.map((c) => [c.code, c]));
    const rateByCompany = new Map(
      rates.map((r) => [r.companyId, num(r.ratePerHour)]),
    );
    const oldByAccount = new Map(oldSlips.map((s) => [s.accountId, s]));
    const defaultTemplate = templates.find((t) => t.isDefault) ?? null;

    // Ngày chính thức từng người: công hưởng lương trước ngày này tính lương thử việc.
    const officialByAccount = new Map(
      accounts.map((a) => [a.id, a.payrollSetting?.officialDate ?? null]),
    );
    const att = new Map<string, Record<string, number>>();
    for (const row of attendance) {
      const m = att.get(row.accountId) ?? {};
      m[row.status] = (m[row.status] ?? 0) + 1;
      // ✓ = 1, ½ = 0,5, nghỉ phép / nghỉ lễ vẫn hưởng 100% lương cơ bản.
      const paid =
        row.status === 'present' ||
        row.status === 'paid_leave' ||
        row.status === 'holiday'
          ? 1
          : row.status === 'half'
            ? 0.5
            : 0;
      const official = officialByAccount.get(row.accountId);
      const key = official && row.date < official ? 'probation' : 'official';
      m[key] = (m[key] ?? 0) + paid;
      att.set(row.accountId, m);
    }
    const sale = new Map<
      string,
      { count: number; hours: number; commission: number }
    >();
    for (const row of sales) {
      const m = sale.get(row.saleUserId!) ?? {
        count: 0,
        hours: 0,
        commission: 0,
      };
      const hours = num(row.totalHours);
      m.count += 1;
      m.hours += hours;
      m.commission +=
        hours * (row.companyId ? (rateByCompany.get(row.companyId) ?? 0) : 0);
      sale.set(row.saleUserId!, m);
    }

    const writes: Prisma.PrismaPromise<unknown>[] = [];
    for (const acc of accounts) {
      const setting = acc.payrollSetting;
      const old = oldByAccount.get(acc.id);
      // Có tên trong bảng lương: người được chấm công, hoặc người đã đặt lương cơ bản.
      if (!old && !acc.attendanceTracked && num(setting?.baseSalary) <= 0)
        continue;

      const a = att.get(acc.id) ?? {};
      const s = sale.get(acc.id) ?? { count: 0, hours: 0, commission: 0 };
      const worked = (a.present ?? 0) + (a.half ?? 0) * 0.5;
      const inputs: Record<string, number> = {
        LUONG_CO_BAN: num(setting?.baseSalary),
        MUC_HOA_HONG: num(setting?.commissionRate),
        CONG_CHUAN: standardDays,
        CONG_THUC_TE: worked,
        NGAY_NGHI_PHEP: a.paid_leave ?? 0,
        NGAY_LE: a.holiday ?? 0,
        CONG_HUONG_LUONG: worked + (a.paid_leave ?? 0) + (a.holiday ?? 0),
        CONG_THU_VIEC: a.probation ?? 0,
        CONG_CHINH_THUC: a.official ?? 0,
        NGAY_NGHI_KHONG_PHEP: a.unpaid_leave ?? 0,
        NGAY_NGHI_BU: a.compensatory_leave ?? 0,
        SO_LAO_DONG: s.count,
        TONG_GIO_DS: s.hours,
        HOA_HONG_GIO: s.commission,
      };
      const manualValues = (old?.manualValues ?? {}) as Record<string, number>;

      const template =
        templates.find((t) => t.id === setting?.templateId) ??
        templates.find((t) => t.roles.includes(acc.role)) ??
        defaultTemplate;
      const overrides = (setting?.overrides ?? {}) as Record<string, string>;
      const { lines, net } = calcLines(
        (template?.items ?? []) as unknown as TemplateItem[],
        componentByCode,
        overrides,
        inputs,
        manualValues,
      );

      const data = {
        templateName: template?.name ?? null,
        inputs,
        lines: lines as unknown as Prisma.InputJsonValue,
        netPay: net,
        // Số thay đổi sau khi nhân viên đã đồng ý → phải xác nhận lại.
        ...(old && old.confirmStatus === 'confirmed' && num(old.netPay) !== net
          ? { confirmStatus: 'pending', respondedAt: null }
          : {}),
      };
      writes.push(
        old
          ? this.prisma.payrollSlip.update({ where: { id: old.id }, data })
          : this.prisma.payrollSlip.create({
              data: { payrollId, accountId: acc.id, ...data },
            }),
      );
    }
    await this.prisma.$transaction(writes);
    return { ok: true };
  }

  async getPayroll(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        slips: {
          include: {
            account: ACCOUNT_PROFILE,
          },
        },
      },
    });
    if (!payroll) throw new NotFoundException('Không tìm thấy bảng lương');
    const slips = payroll.slips
      .map((s) => ({
        ...serializeSlip(s),
        account_id: s.accountId,
        full_name: s.account.fullName,
        role: s.account.role,
        position: s.account.position,
        team_name: s.account.team?.name ?? null,
        bank_account_number: s.account.bankAccountNumber,
      }))
      .sort((x, y) => x.full_name.localeCompare(y.full_name, 'vi'));
    return {
      id: payroll.id,
      year: payroll.year,
      month: payroll.month,
      status: payroll.status,
      locked_at: payroll.lockedAt,
      sent_at: payroll.sentAt,
      completed_at: payroll.completedAt,
      slips,
    };
  }

  async updateSlip(slipId: string, dto: UpdateSlipDto) {
    const slip = await this.prisma.payrollSlip.findUnique({
      where: { id: slipId },
      include: { payroll: true },
    });
    if (!slip) throw new NotFoundException('Không tìm thấy phiếu lương');
    if (slip.payroll.status !== 'draft') {
      throw new ConflictException('Bảng lương đã chốt — mở chốt trước khi sửa');
    }
    await this.prisma.payrollSlip.update({
      where: { id: slipId },
      data: {
        manualValues: cleanManualValues(dto.manual_values),
        note: dto.note?.trim() || null,
      },
    });
    return this.compute(slip.payrollId);
  }

  async deletePayroll(id: string) {
    const payroll = await this.getPayrollOrThrow(id);
    if (payroll.status !== 'draft')
      throw new ConflictException('Chỉ xoá được bảng lương đang nháp');
    await this.prisma.payroll.delete({ where: { id } });
    return { ok: true };
  }

  /** Chốt / mở chốt / gửi nhân viên / hoàn thành. */
  async changeStatus(
    id: string,
    action: 'lock' | 'unlock' | 'send' | 'complete',
    user: AuthenticatedUser,
  ) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        slips: {
          select: { accountId: true, confirmStatus: true, lines: true },
        },
      },
    });
    if (!payroll) throw new NotFoundException('Không tìm thấy bảng lương');
    const now = new Date();
    const period = `tháng ${payroll.month}/${payroll.year}`;

    if (action === 'lock') {
      if (payroll.status !== 'draft')
        throw new ConflictException('Bảng lương không ở trạng thái nháp');
      const broken = payroll.slips.some((s) =>
        (s.lines as unknown as SlipLine[]).some((l) => l.error),
      );
      if (broken)
        throw new ConflictException(
          'Còn phiếu lương có công thức lỗi (ô màu đỏ) — sửa xong mới chốt được',
        );
      await this.prisma.payroll.update({
        where: { id },
        data: { status: 'locked', lockedAt: now },
      });
    } else if (action === 'unlock') {
      if (payroll.status !== 'locked' && payroll.status !== 'sent') {
        throw new ConflictException(
          'Chỉ mở chốt được bảng lương đã chốt hoặc đã gửi (chưa hoàn thành)',
        );
      }
      await this.prisma.payroll.update({
        where: { id },
        data: { status: 'draft', lockedAt: null, sentAt: null },
      });
    } else if (action === 'send') {
      if (payroll.status !== 'locked')
        throw new ConflictException(
          'Phải chốt bảng lương trước khi gửi nhân viên',
        );
      await this.prisma.$transaction([
        this.prisma.payroll.update({
          where: { id },
          data: { status: 'sent', sentAt: now },
        }),
        // Người đã thắc mắc lần trước xem lại phiếu mới.
        this.prisma.payrollSlip.updateMany({
          where: { payrollId: id, confirmStatus: 'question' },
          data: { confirmStatus: 'pending', respondedAt: null },
        }),
        this.prisma.notification.createMany({
          data: payroll.slips.map((s) => ({
            accountId: s.accountId,
            senderId: user.id,
            type: 'admin_message' as const,
            channel: 'in_app' as const,
            content: `Phiếu lương ${period} đã có. Vào Chấm công → nút "Phiếu lương" để kiểm tra và xác nhận.`,
            scheduledAt: now,
            sentAt: now,
            status: 'sent' as const,
          })),
        }),
      ]);
    } else {
      if (payroll.status !== 'sent')
        throw new ConflictException(
          'Phải gửi nhân viên kiểm tra trước khi hoàn thành',
        );
      if (payroll.slips.some((s) => s.confirmStatus === 'question')) {
        throw new ConflictException(
          'Còn nhân viên đang thắc mắc phiếu lương — xử lý xong mới hoàn thành được',
        );
      }
      await this.prisma.payroll.update({
        where: { id },
        data: { status: 'completed', completedAt: now },
      });
    }
    return { ok: true };
  }

  /** File Excel để kế toán đi lệnh ngân hàng. */
  async exportXlsx(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const payroll = await this.getPayroll(id);
    const codes: { code: string; name: string }[] = [];
    for (const s of payroll.slips) {
      for (const l of s.lines)
        if (!codes.some((c) => c.code === l.code))
          codes.push({ code: l.code, name: l.name });
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Lương T${payroll.month}-${payroll.year}`);
    ws.addRow([
      'STT',
      'Họ và tên',
      'Nhóm',
      'Số tài khoản',
      'Ngân hàng',
      'Chủ tài khoản',
      'Công thực tế',
      'Công hưởng lương',
      ...codes.map((c) => c.name),
      'Thực lĩnh',
      'Xác nhận',
      'Ghi chú',
    ]);
    ws.getRow(1).font = { bold: true };
    payroll.slips.forEach((s, i) => {
      ws.addRow([
        i + 1,
        s.full_name,
        s.team_name ?? '',
        s.bank_account_number ?? '',
        s.profile?.bank_name ?? '',
        s.profile?.bank_account_holder ?? '',
        s.inputs.CONG_THUC_TE ?? 0,
        s.inputs.CONG_HUONG_LUONG ?? 0,
        ...codes.map((c) => s.lines.find((l) => l.code === c.code)?.value ?? 0),
        s.net_pay,
        s.confirm_status === 'confirmed'
          ? 'Đã đồng ý'
          : s.confirm_status === 'question'
            ? 'Thắc mắc'
            : 'Chưa xác nhận',
        s.note ?? '',
      ]);
    });
    ws.addRow([
      '',
      'Tổng cộng',
      '',
      '',
      '',
      '',
      '',
      '',
      ...codes.map(() => ''),
      payroll.slips.reduce((t, s) => t + s.net_pay, 0),
    ]).font = { bold: true };
    ws.columns.forEach((col, i) => {
      col.width = i === 1 ? 28 : i === 0 ? 6 : 18;
      if (i >= 8) col.numFmt = '#,##0';
    });
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return {
      buffer,
      filename: `bang-luong-${payroll.year}-${String(payroll.month).padStart(2, '0')}.xlsx`,
    };
  }

  // ── Báo cáo ─────────────────────────────────────────────────────────────────

  /** Tổng hợp từng bảng lương: tổng thực lĩnh, tổng theo từng khoản, theo từng vị trí. */
  async reportOverview() {
    const payrolls = await this.prisma.payroll.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        slips: {
          select: {
            netPay: true,
            lines: true,
            confirmStatus: true,
            question: true,
            account: { select: { role: true, fullName: true } },
          },
        },
      },
    });
    return payrolls.map((p) => {
      const byComponent = new Map<
        string,
        { code: string; name: string; nature: string; total: number }
      >();
      const byRole = new Map<
        string,
        { role: string; count: number; total: number }
      >();
      let total = 0;
      for (const s of p.slips) {
        const net = num(s.netPay);
        total += net;
        const r = byRole.get(s.account.role) ?? {
          role: s.account.role,
          count: 0,
          total: 0,
        };
        r.count += 1;
        r.total += net;
        byRole.set(s.account.role, r);
        for (const l of s.lines as unknown as SlipLine[]) {
          const c = byComponent.get(l.code) ?? {
            code: l.code,
            name: l.name,
            nature: l.nature,
            total: 0,
          };
          c.total += l.value;
          byComponent.set(l.code, c);
        }
      }
      return {
        id: p.id,
        year: p.year,
        month: p.month,
        status: p.status,
        slip_count: p.slips.length,
        total_net_pay: total,
        confirmed_count: p.slips.filter((s) => s.confirmStatus === 'confirmed')
          .length,
        question_count: p.slips.filter((s) => s.confirmStatus === 'question')
          .length,
        by_component: [...byComponent.values()],
        by_role: [...byRole.values()].sort((a, b) => b.total - a.total),
        // Cho biểu đồ phân bố mức lương + khung "Phản hồi phiếu lương" ở Tổng quan.
        net_pays: p.slips.map((s) => num(s.netPay)),
        questions: p.slips
          .filter((s) => s.confirmStatus === 'question')
          .map((s) => ({
            full_name: s.account.fullName,
            question: s.question,
          })),
      };
    });
  }

  /** Lịch sử lương của 1 nhân viên qua các tháng. */
  async reportAccountHistory(accountId: string) {
    const slips = await this.prisma.payrollSlip.findMany({
      where: { accountId },
      include: { payroll: true, account: ACCOUNT_PROFILE },
      orderBy: [{ payroll: { year: 'desc' } }, { payroll: { month: 'desc' } }],
    });
    return slips.map((s) => ({
      ...serializeSlip(s),
      year: s.payroll.year,
      month: s.payroll.month,
      payroll_status: s.payroll.status,
    }));
  }

  // ── Phiếu lương của tôi (mọi nhân viên) ─────────────────────────────────────

  async listMySlips(user: AuthenticatedUser) {
    const slips = await this.prisma.payrollSlip.findMany({
      where: {
        accountId: user.id,
        payroll: { status: { in: ['sent', 'completed'] } },
      },
      include: { payroll: true, account: ACCOUNT_PROFILE },
      orderBy: [{ payroll: { year: 'desc' } }, { payroll: { month: 'desc' } }],
    });
    return slips.map((s) => ({
      ...serializeSlip(s),
      // Nhân viên chỉ thấy các khoản được đánh dấu "hiện trên phiếu lương".
      lines: (s.lines as unknown as SlipLine[]).filter((l) => l.show),
      year: s.payroll.year,
      month: s.payroll.month,
      payroll_status: s.payroll.status,
    }));
  }

  async respondMySlip(
    slipId: string,
    dto: RespondSlipDto,
    user: AuthenticatedUser,
  ) {
    const slip = await this.prisma.payrollSlip.findUnique({
      where: { id: slipId },
      include: { payroll: true, account: { select: { fullName: true } } },
    });
    if (!slip || slip.accountId !== user.id)
      throw new NotFoundException('Không tìm thấy phiếu lương');
    if (slip.payroll.status !== 'sent')
      throw new ConflictException('Phiếu lương này không còn ở bước xác nhận');
    const question = dto.question?.trim();
    if (dto.action === 'question' && !question) {
      throw new UnprocessableEntityException('Hãy ghi rõ nội dung thắc mắc');
    }
    const now = new Date();
    await this.prisma.payrollSlip.update({
      where: { id: slipId },
      data: {
        confirmStatus: dto.action === 'confirm' ? 'confirmed' : 'question',
        question: dto.action === 'confirm' ? null : question,
        respondedAt: now,
      },
    });
    if (dto.action === 'question') {
      await this.prisma.notification.create({
        data: {
          accountId: slip.payroll.createdById,
          senderId: user.id,
          type: 'admin_message',
          channel: 'in_app',
          content: `${slip.account.fullName} thắc mắc phiếu lương tháng ${slip.payroll.month}/${slip.payroll.year}: ${question}`,
          scheduledAt: now,
          sentAt: now,
          status: 'sent',
        },
      });
    }
    return { ok: true };
  }
}

/** Thông tin cá nhân in trên phiếu lương (đầu phiếu + ngân hàng). */
const ACCOUNT_PROFILE = {
  select: {
    fullName: true,
    role: true,
    position: true,
    hireDate: true,
    bankAccountNumber: true,
    team: { select: { name: true } },
    payrollSetting: {
      select: { officialDate: true, bankName: true, bankAccountHolder: true },
    },
  },
} as const;

/** Chỉ giữ số không âm, làm tròn đồng. */
function cleanManualValues(values: Record<string, unknown> | undefined) {
  const out: Record<string, number> = {};
  for (const [code, v] of Object.entries(values ?? {})) {
    const n = Math.round(Number(v));
    if (/^[A-Z][A-Z0-9_]*$/.test(code) && Number.isFinite(n) && n > 0)
      out[code] = n;
  }
  return out;
}

function serializeSlip(s: {
  id: string;
  templateName: string | null;
  manualValues: unknown;
  note: string | null;
  inputs: unknown;
  lines: unknown;
  netPay: unknown;
  confirmStatus: string;
  question: string | null;
  respondedAt: Date | null;
  account?: {
    fullName: string;
    role: string;
    position: string | null;
    hireDate: Date | null;
    bankAccountNumber: string | null;
    team: { name: string } | null;
    payrollSetting: {
      officialDate: Date | null;
      bankName: string | null;
      bankAccountHolder: string | null;
    } | null;
  };
}) {
  const a = s.account;
  return {
    id: s.id,
    template_name: s.templateName,
    manual_values: (s.manualValues ?? {}) as Record<string, number>,
    note: s.note,
    inputs: s.inputs as Record<string, number>,
    lines: s.lines as SlipLine[],
    net_pay: num(s.netPay),
    confirm_status: s.confirmStatus,
    question: s.question,
    responded_at: s.respondedAt,
    profile: a
      ? {
          full_name: a.fullName,
          role: a.role,
          position: a.position,
          team_name: a.team?.name ?? null,
          hire_date: fromDate(a.hireDate),
          official_date: fromDate(a.payrollSetting?.officialDate),
          bank_account_number: a.bankAccountNumber,
          bank_name: a.payrollSetting?.bankName ?? null,
          bank_account_holder: a.payrollSetting?.bankAccountHolder ?? null,
        }
      : null,
  };
}

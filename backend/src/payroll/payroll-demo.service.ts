import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { evaluateFormula } from './formula';
import { isIncome, PayrollService, type SlipLine } from './payroll.service';

/**
 * Dữ liệu DEMO để xem giao diện Tiền lương (2026-11-13) — CHỈ chạy ở máy dev
 * (NODE_ENV khác "production"); trên máy chủ thật luôn bị từ chối. Số công / doanh số
 * trong các phiếu demo là số giả, không lấy từ Chấm công hay Nhập doanh số.
 */
const BASE_BY_ROLE: Record<string, number> = {
  admin: 20_000_000,
  manager: 18_000_000,
  leader: 12_000_000,
  sup_leader: 10_000_000,
  accounting: 10_000_000,
  mkt: 9_000_000,
};
const rand = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

@Injectable()
export class PayrollDemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payroll: PayrollService,
  ) {}

  get available(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private assertAvailable() {
    if (!this.available) {
      throw new ForbiddenException('Dữ liệu demo chỉ dùng trên máy dev');
    }
  }

  /** Tạo mức lương, mức hoa hồng còn thiếu và 6 bảng lương gần nhất (tháng nào đã có thì bỏ qua). */
  async seed(user: AuthenticatedUser) {
    this.assertAvailable();
    const components = await this.payroll.listComponents();
    const templates = await this.payroll.listTemplates();

    const companies = await this.prisma.orderRecord.findMany({
      select: { id: true, commissionRate: true },
    });
    for (const c of companies) {
      if (c.commissionRate) continue;
      await this.prisma.payrollCommissionRate.create({
        data: { companyId: c.id, ratePerHour: rand(2, 6) * 500 },
      });
    }

    const accounts = await this.prisma.account.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true, role: true, fullName: true, payrollSetting: true },
    });
    const banks = [
      'VIETCOMBANK',
      'TECHCOMBANK',
      'MB BANK',
      'VIETINBANK',
      'BIDV',
    ];
    for (const [i, a] of accounts.entries()) {
      if (a.payrollSetting) continue;
      const boss = ['admin', 'manager', 'leader'].includes(a.role);
      // Phụ cấp cố định từng người đặt bằng công thức riêng — giống cách kế toán sẽ làm.
      const overrides: Record<string, string> = {
        PC_DIEN_THOAI: String(boss ? 1_500_000 : 300_000),
        BAO_HIEM: '525000',
      };
      if (boss) overrides.PC_TRACH_NHIEM = String(rand(2, 6) * 500_000);
      if (i % 3 === 0) overrides.PC_NHA_O = '2500000';
      if (i % 4 === 1) overrides.PC_CHUYEN_CAN = '500000';
      // Vài người mới vào: chính thức từ giữa tháng trước → tháng trước có lương thử việc.
      const now = new Date();
      const officialDate =
        i % 5 === 2
          ? new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 15))
          : new Date(Date.UTC(now.getFullYear() - 1, rand(0, 11), rand(1, 28)));
      await this.prisma.payrollAccountSetting.create({
        data: {
          accountId: a.id,
          baseSalary: BASE_BY_ROLE[a.role] ?? rand(14, 18) * 500_000,
          // Sale tính cứng 50.000đ/người; còn lại hoa hồng theo giờ của công ty.
          commissionRate: a.role === 'sale' && i % 2 === 0 ? 50_000 : 0,
          overrides,
          officialDate,
          bankName: banks[i % banks.length],
          bankAccountHolder: a.fullName
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toUpperCase(),
        },
      });
    }
    const settings = new Map(
      (await this.prisma.payrollAccountSetting.findMany()).map((s) => [
        s.accountId,
        s,
      ]),
    );

    const now = new Date();
    let created = 0;
    for (let back = 5; back >= 0; back--) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - back, 1));
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const exists = await this.prisma.payroll.findUnique({
        where: { year_month: { year, month } },
      });
      if (exists) continue;

      let standardDays = 0;
      const end = new Date(Date.UTC(year, month, 1));
      for (const x = new Date(d); x < end; x.setUTCDate(x.getUTCDate() + 1)) {
        if (x.getUTCDay() !== 0) standardDays++;
      }
      // Tháng này: nháp · tháng trước: đã gửi, đang chờ xác nhận · cũ hơn: hoàn thành.
      const status = back === 0 ? 'draft' : back === 1 ? 'sent' : 'completed';

      const slips = accounts.map((a, index) => {
        const setting = settings.get(a.id);
        const leave = rand(0, 1);
        const holiday = back % 3 === 0 ? 1 : 0;
        const unpaid = rand(0, 4) === 0 ? 1 : 0;
        const worked =
          standardDays - leave - holiday - unpaid - rand(0, 1) * 0.5;
        const isSeller = ['sale', 'sup_leader', 'leader'].includes(a.role);
        const count = isSeller ? rand(2, 14) : 0;
        const hours = count * rand(140, 210);
        const inputs: Record<string, number> = {
          LUONG_CO_BAN: Number(setting?.baseSalary ?? 0),
          MUC_HOA_HONG: Number(setting?.commissionRate ?? 0),
          CONG_CHUAN: standardDays,
          CONG_THUC_TE: worked,
          NGAY_NGHI_PHEP: leave,
          NGAY_LE: holiday,
          CONG_HUONG_LUONG: worked + leave + holiday,
          NGAY_NGHI_KHONG_PHEP: unpaid,
          NGAY_NGHI_BU: 0,
          SO_LAO_DONG: count,
          TONG_GIO_DS: hours,
          HOA_HONG_GIO: hours * rand(2, 5) * 500,
        };
        const official = setting?.officialDate;
        const probation =
          official && official > d ? Math.min(14, inputs.CONG_HUONG_LUONG) : 0;
        inputs.CONG_THU_VIEC = probation;
        inputs.CONG_CHINH_THUC = inputs.CONG_HUONG_LUONG - probation;
        // Khoản nhập tay mỗi tháng (ứng lương, phạt, lễ…).
        const manualValues: Record<string, number> = {};
        if (rand(0, 5) === 0) manualValues.UNG_LUONG = rand(1, 3) * 1_000_000;
        if (rand(0, 6) === 0) manualValues.PHAT = rand(1, 4) * 50_000;
        if (holiday && rand(0, 3) === 0)
          manualValues.LUONG_NGAY_LE = rand(4, 8) * 100_000;
        const overrides = (setting?.overrides ?? {}) as Record<string, string>;
        const template =
          templates.find((t) => t.roles.includes(a.role)) ??
          templates.find((t) => t.is_default);
        const scope = { ...inputs };
        const lines: SlipLine[] = [];
        let net = 0;
        for (const item of template?.items ?? []) {
          const comp = components.find((c) => c.code === item.code);
          if (!comp) continue;
          const formula = (
            overrides[item.code] ||
            item.formula ||
            comp.formula ||
            ''
          ).trim();
          let value = formula ? 0 : (manualValues[comp.code] ?? 0);
          if (formula) {
            try {
              value = Math.round(evaluateFormula(formula, scope));
            } catch {
              // Công thức lỗi thì để 0 — demo không cần báo lỗi.
            }
          }
          scope[comp.code] = value;
          if (isIncome(comp.nature)) net += value;
          else if (comp.nature === 'deduction') net -= value;
          lines.push({
            code: comp.code,
            name: comp.name,
            nature: comp.nature,
            formula,
            value,
            show: comp.show_on_payslip,
            ...(formula ? {} : { manual: true }),
          });
        }
        const asks = status === 'sent' && index % 9 === 4;
        const confirmed =
          status === 'completed' || (status === 'sent' && index % 3 !== 0);
        return {
          accountId: a.id,
          templateName: template?.name ?? null,
          manualValues,
          inputs,
          lines: lines as unknown as Prisma.InputJsonValue,
          netPay: net,
          confirmStatus: asks
            ? 'question'
            : confirmed
              ? 'confirmed'
              : 'pending',
          question: asks
            ? 'Em thấy thiếu 1 ngày công ngày 15, nhờ chị kiểm tra lại giúp em.'
            : null,
          respondedAt: asks || confirmed ? new Date() : null,
        };
      });

      await this.prisma.payroll.create({
        data: {
          year,
          month,
          status,
          createdById: user.id,
          lockedAt: status === 'draft' ? null : end,
          sentAt: status === 'draft' ? null : end,
          completedAt: status === 'completed' ? end : null,
          slips: { create: slips },
        },
      });
      created++;
    }
    return { created };
  }

  /** Xoá TOÀN BỘ dữ liệu tiền lương; mở lại trang sẽ tự tạo lại bộ thành phần + mẫu Saram. */
  async clear() {
    this.assertAvailable();
    await this.prisma.$transaction([
      this.prisma.payroll.deleteMany(),
      this.prisma.payrollAccountSetting.deleteMany(),
      this.prisma.payrollCommissionRate.deleteMany(),
      this.prisma.payrollTemplate.deleteMany(),
      this.prisma.payrollComponent.deleteMany(),
    ]);
    return { ok: true };
  }
}

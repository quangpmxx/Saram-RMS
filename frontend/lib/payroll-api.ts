import { clientApi } from "./api-client";
import type { AccountRole } from "./types";

/** Tiền lương (2026-11-13) — kiểu dữ liệu + lớp gọi API /payroll và /my-payslip. */

export type PayrollNature = "income" | "allowance" | "deduction" | "info";
/** Khoản cộng vào Tổng lương (1): thu nhập + phụ cấp. */
export const isIncome = (n: PayrollNature) => n === "income" || n === "allowance";
export const NATURE_LABEL: Record<PayrollNature, string> = {
  income: "Thu nhập",
  allowance: "Phụ cấp",
  deduction: "Khấu trừ",
  info: "Chỉ để xem",
};

export interface PayrollVariable {
  code: string;
  label: string;
}
export interface PayrollComponent {
  id: string;
  code: string;
  name: string;
  nature: PayrollNature;
  formula: string | null;
  show_on_payslip: boolean;
  sort_order: number;
}
export interface PayrollTemplateItem {
  code: string;
  formula?: string | null;
}
export interface PayrollTemplate {
  id: string;
  name: string;
  roles: AccountRole[];
  is_default: boolean;
  items: PayrollTemplateItem[];
}
/** Kết quả xem trước 1 mẫu: phiếu lương tính thử, không lưu. */
export interface TemplatePreview {
  year: number;
  month: number;
  /** true = số công / doanh số là số minh hoạ (nhân viên mẫu, hoặc người chưa có phiếu nào). */
  sample_data: boolean;
  slip: SlipBase;
}
export interface PayrollAccountSetting {
  account_id: string;
  full_name: string;
  role: AccountRole;
  position: string | null;
  team_name: string | null;
  attendance_tracked: boolean;
  base_salary: number;
  commission_rate: number;
  template_id: string | null;
  overrides: Record<string, string>;
  hire_date: string | null;
  bank_account_number: string | null;
  official_date: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
}
export interface CommissionRate {
  company_id: string;
  company_name: string;
  rate_per_hour: number;
}
export type PayrollStatus = "draft" | "locked" | "sent" | "completed";
export const PAYROLL_STATUS_LABEL: Record<PayrollStatus, string> = {
  draft: "Đang nháp",
  locked: "Đã chốt",
  sent: "Đã gửi nhân viên",
  completed: "Hoàn thành",
};
export interface PayrollSummary {
  id: string;
  year: number;
  month: number;
  status: PayrollStatus;
  slip_count: number;
  total_net_pay: number;
  confirmed_count: number;
  question_count: number;
}
export interface SlipLine {
  code: string;
  name: string;
  nature: PayrollNature;
  formula: string;
  value: number;
  show: boolean;
  manual?: boolean;
  error?: string;
}
export type ConfirmStatus = "pending" | "confirmed" | "question";
export interface SlipBase {
  id: string;
  template_name: string | null;
  manual_values: Record<string, number>;
  note: string | null;
  inputs: Record<string, number>;
  lines: SlipLine[];
  net_pay: number;
  confirm_status: ConfirmStatus;
  question: string | null;
  responded_at: string | null;
  profile: SlipProfile | null;
}
/** Thông tin in ở đầu phiếu lương + phần ngân hàng. */
export interface SlipProfile {
  full_name: string;
  role: AccountRole;
  position: string | null;
  team_name: string | null;
  hire_date: string | null;
  official_date: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
}
export interface PayrollSlip extends SlipBase {
  account_id: string;
  full_name: string;
  role: AccountRole;
  position: string | null;
  team_name: string | null;
  bank_account_number: string | null;
}
export interface PayrollDetail {
  id: string;
  year: number;
  month: number;
  status: PayrollStatus;
  slips: PayrollSlip[];
}
export interface MySlip extends SlipBase {
  year: number;
  month: number;
  payroll_status: PayrollStatus;
}

export interface PayrollReportRow extends PayrollSummary {
  by_component: { code: string; name: string; nature: PayrollNature; total: number }[];
  by_role: { role: AccountRole; count: number; total: number }[];
  net_pays: number[];
  questions: { full_name: string; question: string | null }[];
}

export const formatMoney = (n: number) => Math.round(n).toLocaleString("vi-VN");
/** Ô nhập tiền: chỉ giữ chữ số. */
export const parseMoney = (text: string) => Number(text.replace(/[^\d]/g, "")) || 0;

const send = <T>(path: string, method: string, body?: unknown) =>
  clientApi<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const payrollApi = {
  variables: () => clientApi<PayrollVariable[]>("/payroll/variables"),
  components: () => clientApi<PayrollComponent[]>("/payroll/components"),
  saveComponent: (id: string | null, body: Omit<PayrollComponent, "id" | "sort_order">) =>
    send(id ? `/payroll/components/${id}` : "/payroll/components", id ? "PUT" : "POST", body),
  deleteComponent: (id: string) => send(`/payroll/components/${id}`, "DELETE"),
  templates: () => clientApi<PayrollTemplate[]>("/payroll/templates"),
  saveTemplate: (id: string | null, body: Omit<PayrollTemplate, "id">) =>
    send(id ? `/payroll/templates/${id}` : "/payroll/templates", id ? "PUT" : "POST", body),
  deleteTemplate: (id: string) => send(`/payroll/templates/${id}`, "DELETE"),
  /** Xem trước mẫu đang sửa (chưa lưu). */
  previewTemplate: (items: PayrollTemplateItem[], accountId?: string, name?: string) =>
    send<TemplatePreview>("/payroll/templates/preview", "POST", { items, account_id: accountId || undefined, name: name || undefined }),
  /** Xem trước mẫu đã lưu. */
  previewSavedTemplate: (id: string, accountId?: string) =>
    clientApi<TemplatePreview>(`/payroll/templates/${id}/preview${accountId ? `?account_id=${accountId}` : ""}`),
  accountSettings: () => clientApi<PayrollAccountSetting[]>("/payroll/account-settings"),
  saveAccountSetting: (
    accountId: string,
    body: Pick<
      PayrollAccountSetting,
      "base_salary" | "commission_rate" | "template_id" | "overrides" | "official_date" | "bank_name" | "bank_account_holder"
    >,
  ) => send(`/payroll/account-settings/${accountId}`, "PUT", body),
  commissionRates: () => clientApi<CommissionRate[]>("/payroll/commission-rates"),
  saveCommissionRates: (rates: { company_id: string; rate_per_hour: number }[]) =>
    send("/payroll/commission-rates", "PUT", { rates }),
  periods: () => clientApi<PayrollSummary[]>("/payroll/periods"),
  createPeriod: (year: number, month: number) => send<{ id: string }>("/payroll/periods", "POST", { year, month }),
  period: (id: string) => clientApi<PayrollDetail>(`/payroll/periods/${id}`),
  recompute: (id: string) => send(`/payroll/periods/${id}/recompute`, "POST"),
  changeStatus: (id: string, action: "lock" | "unlock" | "send" | "complete") =>
    send(`/payroll/periods/${id}/status`, "POST", { action }),
  deletePeriod: (id: string) => send(`/payroll/periods/${id}`, "DELETE"),
  updateSlip: (id: string, body: Pick<SlipBase, "manual_values" | "note">) =>
    send(`/payroll/slips/${id}`, "PUT", body),
  exportPath: (id: string) => `/payroll/periods/${id}/export`,
  demoAvailable: () => clientApi<{ available: boolean }>("/payroll/demo"),
  seedDemo: () => send<{ created: number }>("/payroll/demo", "POST"),
  clearDemo: () => send("/payroll/demo", "DELETE"),
  reportOverview: () => clientApi<PayrollReportRow[]>("/payroll/reports/overview"),
  reportAccountHistory: (accountId: string) => clientApi<MySlip[]>(`/payroll/reports/account/${accountId}`),
  mySlips: () => clientApi<MySlip[]>("/my-payslip"),
  respondMySlip: (id: string, action: "confirm" | "question", question?: string) =>
    send(`/my-payslip/${id}/respond`, "POST", { action, question }),
};

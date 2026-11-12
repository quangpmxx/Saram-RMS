import { Account, SalesEntryRecord } from '../../../generated/prisma/client';

/** Đối tượng "DS Sale" (module con của Nhập doanh số) — dự án phụ, nâng cấp toàn diện. */
export interface DsSaleRowResponseDto {
  id: string;
  /** sale | media | recruitment | shuttle — tab nhỏ chứa dòng này. */
  kind: string;
  /** Kỳ (tháng/năm) của dòng. */
  period_year: number;
  period_month: number;
  work_status: string | null;
  check: DsSaleAccountOptionDto | null;
  total_days: number | null;
  total_hours: number | null;
  /** Các cột của tab Nhập thưởng. */
  amount: number | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  referrer_name: string | null;
  paid_date: string | null;
  employee_code: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  identity_number: string | null;
  hometown: string | null;
  phone: string | null;
  join_date: string | null;
  company: DsSaleCompanyOptionDto | null;
  sale: DsSaleAccountOptionDto | null;
  pickup: DsSaleAccountOptionDto | null;
  note: string | null;
  created_by: { id: string; name: string };
  updated_by: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

/**
 * Dùng chung cho cột "Sale" và "Đưa đón" — cả 2 đều tham chiếu Account thật
 * (Mục 5/6, yêu cầu người dùng), kèm avatar + tên nhóm để phân biệt người
 * trùng tên.
 */
export interface DsSaleAccountOptionDto {
  id: string;
  full_name: string;
  /** Bổ sung 2026-07-26 (yêu cầu trực tiếp người dùng): biệt danh — hiển thị thay họ tên đầy đủ, null = chưa đặt (frontend tự fallback về full_name). */
  nickname: string | null;
  avatar_url: string | null;
  team_name: string | null;
}

/**
 * Cột "Công ty làm" — tham chiếu OrderRecord thật (module "Quản lý đơn
 * hàng", 2026-07-26: "công ty chính là đơn hàng"). Giữ nguyên hình dạng
 * response {id, name} đã thiết kế sẵn từ trước (Mục 4, yêu cầu người dùng:
 * "thiết kế sẵn theo hướng có thể kết nối với nguồn dữ liệu công ty hợp tác
 * sau này") — không đổi hợp đồng API, chỉ đổi nguồn dữ liệu.
 */
export interface DsSaleCompanyOptionDto {
  id: string;
  name: string;
}

type DateOnly = Date | null;

function toDateOnly(date: DateOnly): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

type AccountPick = Pick<
  Account,
  'id' | 'fullName' | 'nickname' | 'avatarUrl'
> & {
  team: { name: string } | null;
};

function toAccountOption(
  account: AccountPick | null,
): DsSaleAccountOptionDto | null {
  if (!account) return null;
  return {
    id: account.id,
    full_name: account.fullName,
    nickname: account.nickname,
    avatar_url: account.avatarUrl,
    team_name: account.team?.name ?? null,
  };
}

export type DsSaleRowWithRelations = SalesEntryRecord & {
  createdBy: Pick<Account, 'id' | 'fullName'>;
  updatedBy: Pick<Account, 'id' | 'fullName'>;
  saleUser: AccountPick | null;
  pickupUser: AccountPick | null;
  checkUser: AccountPick | null;
  company: { id: string; name: string } | null;
};

export function toDsSaleRowResponse(
  record: DsSaleRowWithRelations,
): DsSaleRowResponseDto {
  return {
    id: record.id,
    kind: record.kind,
    period_year: record.periodYear,
    period_month: record.periodMonth,
    work_status: record.workStatus,
    check: toAccountOption(record.checkUser),
    total_days: record.totalDays === null ? null : Number(record.totalDays),
    total_hours: record.totalHours === null ? null : Number(record.totalHours),
    amount: record.amount === null ? null : Number(record.amount),
    bank_account_number: record.bankAccountNumber,
    bank_account_name: record.bankAccountName,
    bank_name: record.bankName,
    referrer_name: record.referrerName,
    paid_date: toDateOnly(record.paidDate),
    employee_code: record.employeeCode,
    full_name: record.fullName,
    date_of_birth: toDateOnly(record.dateOfBirth),
    identity_number: record.identityNumber,
    hometown: record.hometown,
    phone: record.phone,
    join_date: toDateOnly(record.joinDate),
    company: record.company
      ? { id: record.company.id, name: record.company.name }
      : null,
    sale: toAccountOption(record.saleUser),
    pickup: toAccountOption(record.pickupUser),
    note: record.note,
    created_by: { id: record.createdBy.id, name: record.createdBy.fullName },
    updated_by: { id: record.updatedBy.id, name: record.updatedBy.fullName },
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

export const DS_SALE_INCLUDE = {
  createdBy: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
  saleUser: {
    select: {
      id: true,
      fullName: true,
      nickname: true,
      avatarUrl: true,
      team: { select: { name: true } },
    },
  },
  pickupUser: {
    select: {
      id: true,
      fullName: true,
      nickname: true,
      avatarUrl: true,
      team: { select: { name: true } },
    },
  },
  checkUser: {
    select: {
      id: true,
      fullName: true,
      nickname: true,
      avatarUrl: true,
      team: { select: { name: true } },
    },
  },
  company: { select: { id: true, name: true } },
} as const;

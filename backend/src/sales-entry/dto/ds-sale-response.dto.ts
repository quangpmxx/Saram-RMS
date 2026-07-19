import { Account, SalesEntryRecord } from '../../../generated/prisma/client';

/** Đối tượng "DS Sale" (module con của Nhập doanh số) — dự án phụ, nâng cấp toàn diện. */
export interface DsSaleRowResponseDto {
  id: string;
  employee_code: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  identity_number: string | null;
  hometown: string | null;
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
  avatar_url: string | null;
  team_name: string | null;
}

/**
 * Cột "Công ty làm" — CHƯA có bảng công ty hợp tác thật (module "Quản lý
 * đơn hàng" còn để trống chờ phát triển), giữ hình dạng response ổn định
 * sẵn để khi có nguồn thật chỉ cần đổi phần lấy dữ liệu, không đổi hợp đồng
 * API (Mục 4, yêu cầu người dùng: "thiết kế sẵn theo hướng có thể kết nối
 * với nguồn dữ liệu công ty hợp tác sau này").
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

type AccountPick = Pick<Account, 'id' | 'fullName' | 'avatarUrl'> & {
  team: { name: string } | null;
};

function toAccountOption(
  account: AccountPick | null,
): DsSaleAccountOptionDto | null {
  if (!account) return null;
  return {
    id: account.id,
    full_name: account.fullName,
    avatar_url: account.avatarUrl,
    team_name: account.team?.name ?? null,
  };
}

export type DsSaleRowWithRelations = SalesEntryRecord & {
  createdBy: Pick<Account, 'id' | 'fullName'>;
  updatedBy: Pick<Account, 'id' | 'fullName'>;
  saleUser: AccountPick | null;
  pickupUser: AccountPick | null;
};

/**
 * Cột "Công ty làm" chưa có bảng thật để join — `record.companyId` được giữ
 * lại nguyên trạng (Mục 13, "companyId nullable"), nhưng chưa resolve được
 * tên nên hiện luôn trả `company: null` (khớp đúng thực tế "chưa có dữ liệu
 * công ty hợp tác").
 */
export function toDsSaleRowResponse(
  record: DsSaleRowWithRelations,
): DsSaleRowResponseDto {
  return {
    id: record.id,
    employee_code: record.employeeCode,
    full_name: record.fullName,
    date_of_birth: toDateOnly(record.dateOfBirth),
    identity_number: record.identityNumber,
    hometown: record.hometown,
    join_date: toDateOnly(record.joinDate),
    company: null,
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
      avatarUrl: true,
      team: { select: { name: true } },
    },
  },
  pickupUser: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      team: { select: { name: true } },
    },
  },
} as const;

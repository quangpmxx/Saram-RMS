import { Account, ShuttleRecord } from '../../../generated/prisma/client';
import { AccountOptionItemDto } from './sale-account-response.dto';

/** Đối tượng "ShuttleRecord" (Danh sách đưa đón) — dự án phụ, nâng cấp toàn diện. */
export interface ShuttleResponseDto {
  id: string;
  date: string;
  full_name: string;
  phone_number: string;
  /** Yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng" — tham chiếu OrderRecord.id, resolve tên/màu ở frontend qua GET /shuttle/companies (khớp cách các trường "chọn" khác đã làm). */
  company_id: string | null;
  area: string | null;
  type: string | null;
  /** Yêu cầu trực tiếp người dùng (2026-07-28): tham chiếu Account thật (role='sale'/'shuttle_staff'), không còn chuỗi tự do. */
  sale: AccountOptionItemDto | null;
  driver: AccountOptionItemDto | null;
  interview_time: string | null;
  contractor: string | null;
  status: string | null;
  interview_result: string | null;
  note: string | null;
  created_by: { id: string; name: string };
  updated_by: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

type AccountPick = Pick<Account, 'id' | 'fullName' | 'nickname'>;

function toAccountOption(
  account: AccountPick | null,
): AccountOptionItemDto | null {
  if (!account) return null;
  return {
    id: account.id,
    full_name: account.fullName,
    nickname: account.nickname,
  };
}

export type ShuttleWithRelations = ShuttleRecord & {
  createdBy: Pick<Account, 'id' | 'fullName'>;
  updatedBy: Pick<Account, 'id' | 'fullName'>;
  saleUser: AccountPick | null;
  driverUser: AccountPick | null;
};

export function toShuttleResponse(
  record: ShuttleWithRelations,
): ShuttleResponseDto {
  return {
    id: record.id,
    // @db.Date trả về Date lúc nửa đêm UTC — cắt về "YYYY-MM-DD", không dùng
    // toISOString() nguyên vẹn vì phần giờ không có ý nghĩa với cột này.
    date: record.date.toISOString().slice(0, 10),
    full_name: record.fullName,
    phone_number: record.phoneNumber,
    company_id: record.companyId,
    area: record.area,
    type: record.type,
    sale: toAccountOption(record.saleUser),
    driver: toAccountOption(record.driverUser),
    interview_time: record.interviewTime,
    contractor: record.contractor,
    status: record.status,
    interview_result: record.interviewResult,
    note: record.note,
    created_by: { id: record.createdBy.id, name: record.createdBy.fullName },
    updated_by: { id: record.updatedBy.id, name: record.updatedBy.fullName },
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

export const SHUTTLE_INCLUDE = {
  createdBy: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
  saleUser: { select: { id: true, fullName: true, nickname: true } },
  driverUser: { select: { id: true, fullName: true, nickname: true } },
} as const;

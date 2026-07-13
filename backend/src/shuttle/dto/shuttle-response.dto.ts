import { Account, ShuttleRecord } from '../../../generated/prisma/client';

/** Đối tượng "ShuttleRecord" (Danh sách đưa đón) — dự án phụ, nâng cấp toàn diện. */
export interface ShuttleResponseDto {
  id: string;
  date: string;
  full_name: string;
  phone_number: string;
  company: string | null;
  area: string | null;
  type: string | null;
  sale: string | null;
  driver: string | null;
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

type ShuttleWithRelations = ShuttleRecord & {
  createdBy: Pick<Account, 'id' | 'fullName'>;
  updatedBy: Pick<Account, 'id' | 'fullName'>;
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
    company: record.company,
    area: record.area,
    type: record.type,
    sale: record.sale,
    driver: record.driver,
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
} as const;

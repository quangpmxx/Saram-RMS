import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ReportViolationStatus,
  ReportViolationType,
} from '../../../generated/prisma/client';

const VIOLATION_TYPE_VALUES: ReportViolationType[] = [
  'late_submission',
  'no_submission',
];
const STATUS_VALUES: ReportViolationStatus[] = [
  'pending',
  'confirmed',
  'waived',
  'supplemented',
];

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check phạt" — Mục 7: bộ lọc
 * khoảng ngày/nhóm/nhân viên/loại vi phạm/trạng thái + tìm kiếm + phân
 * trang phía server (khớp đúng mặc định page=1/page_size=20 của
 * ListShuttleQueryDto).
 */
export class ListReportPenaltyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size: number = 20;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @IsOptional()
  @IsIn(VIOLATION_TYPE_VALUES)
  violation_type?: ReportViolationType;

  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: ReportViolationStatus;

  /** Tìm theo tên nhân viên. */
  @IsOptional()
  @IsString()
  keyword?: string;
}

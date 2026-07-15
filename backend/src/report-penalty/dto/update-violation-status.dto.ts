import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportViolationStatus } from '../../../generated/prisma/client';

const STATUS_VALUES: ReportViolationStatus[] = [
  'pending',
  'confirmed',
  'waived',
  'supplemented',
];

/** Mục 8, yêu cầu người dùng: Admin/Quản lý cập nhật trạng thái + ghi chú. */
export class UpdateViolationStatusDto {
  @IsIn(STATUS_VALUES)
  status: ReportViolationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

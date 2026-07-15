import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới): 6 trạng thái chấm công cho phép nhập qua API —
 * khớp đúng enum AttendanceStatus (schema.prisma, thêm "compensatory_leave"
 * = Nghỉ bù (B) ngày 2026-07-15, yêu cầu trực tiếp người dùng). "Trống/chưa
 * chấm" KHÔNG có ở đây — dùng endpoint xóa (DELETE) riêng, không phải 1 giá
 * trị status.
 */
const ATTENDANCE_STATUS_VALUES = [
  'present',
  'half',
  'paid_leave',
  'unpaid_leave',
  'holiday',
  'compensatory_leave',
] as const;

/** 1 ô chấm công cần lưu — Mục 1/7, yêu cầu người dùng: "Lưu thay đổi" gửi hàng loạt 1 lần, không lưu ngay theo từng click. */
export class AttendanceCellDto {
  @IsUUID('4')
  account_id: string;

  /** "YYYY-MM-DD" — lưu theo NGÀY THỰC TẾ, không lưu theo vị trí cột (Mục 7, yêu cầu người dùng). */
  @IsDateString()
  date: string;

  @IsEnum(ATTENDANCE_STATUS_VALUES)
  status: (typeof ATTENDANCE_STATUS_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

/** 1 ô cần xóa hẳn trạng thái (trả về "trống/chưa chấm"). */
export class AttendanceDeleteDto {
  @IsUUID('4')
  account_id: string;

  @IsDateString()
  date: string;
}

/**
 * Giới hạn 1 lần lưu tối đa 31 ngày × 500 nhân viên — chặn payload bất
 * thường/lỗi client, không phải giới hạn nghiệp vụ thật (thực tế 1 tháng +
 * toàn bộ nhân viên công ty còn xa mới chạm ngưỡng này).
 */
const MAX_CELLS_PER_SAVE = 15500;

export class BulkSaveAttendanceDto {
  @IsArray()
  @ArrayMaxSize(MAX_CELLS_PER_SAVE)
  @ValidateNested({ each: true })
  @Type(() => AttendanceCellDto)
  upserts: AttendanceCellDto[];

  @IsArray()
  @ArrayMaxSize(MAX_CELLS_PER_SAVE)
  @ValidateNested({ each: true })
  @Type(() => AttendanceDeleteDto)
  deletes: AttendanceDeleteDto[];
}

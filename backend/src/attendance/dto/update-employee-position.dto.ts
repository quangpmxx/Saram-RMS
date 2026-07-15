import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): PUT
 * /attendance/employee/:accountId/position. Cho phép chuỗi rỗng/`null` để
 * XÓA chức vụ tùy chỉnh — khi đó cột "Vị trí" quay về hiện nhãn vai trò mặc
 * định (xem AttendanceEmployeeDto.position).
 */
export class UpdateEmployeePositionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string | null;
}

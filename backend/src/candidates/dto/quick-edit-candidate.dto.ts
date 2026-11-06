import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * UI Polish — PUT /candidate/:id/quick-edit: sửa nhanh Năm sinh/Địa chỉ
 * ngay tại trang Chi tiết ứng viên. API MỚI theo yêu cầu trực tiếp người
 * dùng — KHÔNG thay đổi hành vi/phạm vi quyền của PUT /candidate/:id đã
 * đóng băng (Mục 4, docs/13); xem ghi chú tại candidates.controller.ts.
 * Cho phép gửi `null` để xóa trống trường tương ứng.
 */
export class QuickEditCandidateDto {
  /** Năm sinh nhập tự do (2026-11-06), vd "1995", "khoảng 95", "15/3/1998". */
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Năm sinh tối đa 50 ký tự' })
  birth_year?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;
}

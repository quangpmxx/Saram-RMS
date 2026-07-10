import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * UI Polish — PUT /candidate/:id/quick-edit: sửa nhanh Năm sinh/Địa chỉ
 * ngay tại trang Chi tiết ứng viên. API MỚI theo yêu cầu trực tiếp người
 * dùng — KHÔNG thay đổi hành vi/phạm vi quyền của PUT /candidate/:id đã
 * đóng băng (Mục 4, docs/13); xem ghi chú tại candidates.controller.ts.
 * Cho phép gửi `null` để xóa trống trường tương ứng.
 */
export class QuickEditCandidateDto {
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  birth_year?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;
}

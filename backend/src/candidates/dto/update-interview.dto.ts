import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Mục 6, docs/13-api-design.md — PUT /interview/:id (body): status_id bắt
 * buộc, employment_status_id/employment_reason không bắt buộc (chỉ dùng khi
 * đỗ PV). Ràng buộc nghiệp vụ chi tiết (employment_status_id chỉ hợp lệ khi
 * đỗ PV, employment_reason bắt buộc khi "Không đi làm") kiểm tra ở service —
 * Mục 4, tài liệu 09.
 */
export class UpdateInterviewDto {
  @IsUUID('4')
  status_id: string;

  @IsOptional()
  @IsUUID('4')
  employment_status_id?: string;

  @IsOptional()
  @IsString()
  employment_reason?: string;
}

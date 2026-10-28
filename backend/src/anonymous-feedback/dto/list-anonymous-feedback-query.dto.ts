import { IsDateString, IsOptional } from 'class-validator';

/**
 * Đơn phản ánh ẩn danh — GET /anonymous-feedback. Không phân trang (cùng
 * quy mô nhỏ như ListLeaveRequestQueryDto). `date_from`/`date_to` lọc theo
 * ngày gửi (created_at).
 */
export class ListAnonymousFeedbackQueryDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

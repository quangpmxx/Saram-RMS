import { IsObject } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện: `column_widths` là map tự do
 * {tên_cột: độ_rộng_px} — mỗi trang tự định nghĩa danh sách cột của mình,
 * nên không khai báo cấu trúc cố định ở đây; giá trị được validate (số
 * nguyên, trong khoảng hợp lệ) ở ColumnWidthService.
 */
export class UpdateColumnWidthDto {
  @IsObject()
  column_widths: Record<string, number>;
}

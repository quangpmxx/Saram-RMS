import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16, "Giao diện chúc mừng sinh nhật
 * nhân viên") — Mục 11: chế độ xem thử. 2 tham số dưới đây CHỈ có tác dụng
 * nếu người gọi là Admin VÀ không phải môi trường production (tự kiểm tra
 * ở birthday.service.ts) — người không đủ điều kiện gửi kèm 2 tham số này
 * thì bị ÂM THẦM bỏ qua (không lỗi 403), coi như không truyền gì, tránh lộ
 * thông tin "endpoint có chế độ ẩn" qua mã lỗi.
 */
export class ListBirthdayQueryDto {
  /** "MM-DD" — giả lập "hôm nay" để xem trước giao diện, không đổi ngày sinh thật của ai. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{2}$/, {
    message: 'simulated_date phải theo định dạng MM-DD',
  })
  simulated_date?: string;

  /** Ép 1 tài khoản cụ thể xuất hiện trong danh sách "sinh nhật hôm nay" để xem thử, bất kể ngày sinh thật. */
  @IsOptional()
  @IsUUID()
  force_account_id?: string;
}

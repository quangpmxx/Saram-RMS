import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Đơn phản ánh ẩn danh — POST /anonymous-feedback (multipart: kèm tối đa
 * 5 ảnh ở field "images"). Người gửi lấy từ phiên đăng nhập, không nhận từ body.
 */
export class CreateAnonymousFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề' })
  @MaxLength(300)
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung phản ánh' })
  @MaxLength(10000)
  content: string;

  /**
   * Người nhận (2026-10-30): chuỗi JSON mảng id Admin/Quản lý, vd
   * '["uuid1","uuid2"]'. Bỏ trống hoặc "[]" = gửi tất cả Admin + Quản lý.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recipient_ids?: string;
}

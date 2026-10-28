import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Đơn phản ánh ẩn danh — POST /anonymous-feedback: chỉ tiêu đề + nội dung.
 * Người gửi lấy từ phiên đăng nhập, không nhận từ body.
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
}

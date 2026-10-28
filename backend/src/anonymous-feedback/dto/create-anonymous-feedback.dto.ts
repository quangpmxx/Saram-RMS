import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Đơn phản ánh ẩn danh — POST /anonymous-feedback. Người gửi lấy từ phiên đăng nhập, không nhận từ body. */
export class CreateAnonymousFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập "Kính gửi"' })
  @MaxLength(200)
  recipient: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập "Về việc"' })
  @MaxLength(300)
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung phản ánh' })
  @MaxLength(10000)
  content: string;
}

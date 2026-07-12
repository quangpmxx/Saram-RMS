import { IsString, MinLength } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện: PUT /me/password (tự đổi mật khẩu của
 * chính mình). Khác với POST /account/:id/reset-password (Admin, đặt về
 * mật khẩu mặc định) — endpoint này cho MỌI vai trò tự đặt mật khẩu mới.
 * `MinLength(6)` khớp đúng độ dài mật khẩu mặc định hệ thống đang seed
 * ("123456") — không đặt yêu cầu phức tạp hơn ngoài phạm vi đã có.
 */
export class ChangePasswordDto {
  @IsString()
  current_password: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  new_password: string;

  @IsString()
  @MinLength(6, { message: 'Xác nhận mật khẩu phải có ít nhất 6 ký tự' })
  confirm_password: string;
}

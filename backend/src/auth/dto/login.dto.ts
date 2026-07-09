import { IsNotEmpty, IsString } from 'class-validator';

/** Mục 1, docs/13-api-design.md — POST /login */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;
}

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AccountRole } from '../../../generated/prisma/enums';

/** Mục 2, docs/13-api-design.md — POST /account */
export class CreateAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(150)
  full_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @MaxLength(50)
  username: string;

  @IsEnum(AccountRole, {
    message: 'Vai trò phải là admin, manager, leader, mkt hoặc sale',
  })
  role: AccountRole;

  @IsOptional()
  @IsUUID('4', { message: 'team_id không hợp lệ' })
  team_id?: string;
}

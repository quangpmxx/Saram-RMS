import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AccountStatus } from '../../../generated/prisma/enums';

/** Mục 2, docs/13-api-design.md — PUT /account/:id (chỉ full_name, team_id, status sửa được) */
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @IsOptional()
  @IsUUID('4', { message: 'team_id không hợp lệ' })
  team_id?: string | null;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}

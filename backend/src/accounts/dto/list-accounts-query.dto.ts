import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { AccountRole, AccountStatus } from '../../../generated/prisma/enums';

/** Mục 2, docs/13-api-design.md — GET /account (query) */
export class ListAccountsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size: number = 20;

  @IsOptional()
  @IsEnum(AccountRole)
  role?: AccountRole;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}

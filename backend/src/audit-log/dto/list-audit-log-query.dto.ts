import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { AuditActionType } from '../../../generated/prisma/enums';

/** Mục 9, docs/13-api-design.md — GET /audit-log (query). */
export class ListAuditLogQueryDto {
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
  @IsUUID('4')
  account_id?: string;

  @IsOptional()
  @IsEnum(AuditActionType)
  action_type?: AuditActionType;

  @IsOptional()
  @IsString()
  entity_type?: string;

  @IsOptional()
  @IsUUID('4')
  entity_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

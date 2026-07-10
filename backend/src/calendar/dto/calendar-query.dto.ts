import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/** Mục 7, docs/13-api-design.md — GET /calendar (query). */
export class CalendarQueryDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsUUID('4')
  account_id?: string;
}

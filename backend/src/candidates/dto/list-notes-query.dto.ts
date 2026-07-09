import { IsDateString, IsOptional } from 'class-validator';

/** Mục 6, docs/13-api-design.md — GET /candidate/:id/note (query). */
export class ListNotesQueryDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

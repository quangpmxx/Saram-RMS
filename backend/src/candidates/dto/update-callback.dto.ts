import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

/** Mục 6, docs/13-api-design.md — PUT /callback/:id (body). */
export class UpdateCallbackDto {
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @IsOptional()
  @IsBoolean()
  is_completed?: boolean;
}

import { IsEnum, IsOptional } from 'class-validator';
import { StatusCategory } from '../../../generated/prisma/enums';

/** Mục 9, docs/13-api-design.md — GET /status (query). */
export class ListStatusQueryDto {
  @IsOptional()
  @IsEnum(StatusCategory)
  category?: StatusCategory;
}

import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import {
  SORT_ORDERS,
  type SortOrder,
} from '../../common/utils/sort-order.util';
import {
  CANDIDATE_SORTS,
  type CandidateSort,
} from './list-candidates-query.dto';

/** Mục 4, docs/13-api-design.md — GET /candidate/pending (query). */
export class PendingCandidatesQueryDto {
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
  source_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsIn(CANDIDATE_SORTS)
  sort?: CandidateSort;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}

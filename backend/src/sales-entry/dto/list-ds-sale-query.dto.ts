import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** GET /sales-entry/ds-sale — query lọc + phân trang (Mục 10/11, yêu cầu người dùng). */
export class ListDsSaleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Mặc định 100 dòng/trang, cho chọn 50/100/200 (Mục 11). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  page_size: number = 100;

  /** Tìm theo Mã NV, Họ tên, CMT/CCCD, Quê quán (Mục 10). */
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsDateString()
  join_date_from?: string;

  @IsOptional()
  @IsDateString()
  join_date_to?: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  sale_user_id?: string;

  @IsOptional()
  @IsUUID()
  pickup_user_id?: string;
}

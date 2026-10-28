import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

/** Kho chăm sóc — GET /care-progress (query). Để trống = hôm nay / tháng này (giờ Việt Nam). */
export class CareProgressQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @IsOptional()
  @IsUUID('4')
  team_id?: string;

  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  /** "pending" = Sale còn data chưa xử lý (trong ngày hoặc tồn cũ); "done" = đã xử lý hết. */
  @IsOptional()
  @IsIn(['pending', 'done'])
  status?: 'pending' | 'done';
}

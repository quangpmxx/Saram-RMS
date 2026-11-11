import { IsOptional, IsUUID } from 'class-validator';

/** PUT /candidate/:id/company — dòng "Công ty" của data (2026-11-11). null = bỏ chọn. */
export class UpdateLeadCompanyDto {
  @IsOptional()
  @IsUUID('4', { message: 'company_id không hợp lệ' })
  company_id: string | null;
}

import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Mục 4, docs/13-api-design.md — PUT /candidate/:id ("sửa thông tin cơ bản") */
export class UpdateCandidateDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_number?: string;

  /** Năm sinh nhập tự do (2026-11-06). */
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Năm sinh tối đa 50 ký tự' })
  birth_year?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsUUID('4', { message: 'source_id không hợp lệ' })
  source_id?: string;

  @IsOptional()
  @IsString()
  mkt_note?: string;
}

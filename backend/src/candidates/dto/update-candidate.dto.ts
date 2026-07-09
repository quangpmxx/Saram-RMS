import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  birth_year?: number;

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

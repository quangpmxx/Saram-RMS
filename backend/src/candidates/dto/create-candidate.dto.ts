import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Mục 4, docs/13-api-design.md — POST /candidate */
export class CreateCandidateDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên lao động không được để trống' })
  @MaxLength(150)
  full_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @MaxLength(20)
  phone_number: string;

  @IsUUID('4', { message: 'source_id không hợp lệ' })
  source_id: string;

  @IsOptional()
  @IsString()
  mkt_note?: string;
}

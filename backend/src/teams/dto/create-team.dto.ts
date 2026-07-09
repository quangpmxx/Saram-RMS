import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Mục 3, docs/13-api-design.md — POST /team */
export class CreateTeamDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên nhóm không được để trống' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsUUID('4', { message: 'leader_id không hợp lệ' })
  leader_id?: string;
}

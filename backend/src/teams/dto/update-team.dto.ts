import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Mục 3, docs/13-api-design.md — PUT /team/:id */
export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID('4', { message: 'leader_id không hợp lệ' })
  leader_id?: string | null;
}

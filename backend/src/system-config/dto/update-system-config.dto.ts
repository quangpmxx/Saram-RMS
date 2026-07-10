import { IsNotEmpty, IsString } from 'class-validator';

/** Mục 9, docs/13-api-design.md — PUT /config/:key (body). */
export class UpdateSystemConfigDto {
  @IsString()
  @IsNotEmpty()
  value: string;
}

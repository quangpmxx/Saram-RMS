import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsUUID, ValidateNested } from 'class-validator';

class PermissionGrantItemDto {
  @IsUUID('4')
  permission_id: string;

  @IsBoolean()
  is_granted: boolean;
}

/**
 * Mục 2, docs/13-api-design.md — PUT /account/:id/permission (body):
 * "danh sách các cặp permission_id + is_granted".
 */
export class UpdateAccountPermissionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantItemDto)
  permissions: PermissionGrantItemDto[];
}

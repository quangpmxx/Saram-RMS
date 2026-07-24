import { IsObject } from 'class-validator';
import { MODULE_REGISTRY } from '../module-registry';

const LEVELS = ['none', 'view', 'edit'] as const;

/**
 * PUT /module-permission/:accountId — body là object { [moduleCode]: level }.
 * class-validator không có decorator "map các giá trị đều thuộc enum" sẵn,
 * validate tay trong service (setPermissions()) thay vì cố nặn DTO phức
 * tạp — module list còn mở rộng, không muốn hard-code từng key ở đây.
 */
export class SetModulePermissionsDto {
  @IsObject()
  permissions: Record<string, (typeof LEVELS)[number]>;
}

export const MODULE_CODES = MODULE_REGISTRY.map((m) => m.code);
export { LEVELS as MODULE_PERMISSION_LEVELS };

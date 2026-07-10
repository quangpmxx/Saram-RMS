import { Permission } from '../../../generated/prisma/client';

/** Đối tượng "Permission" — Mục 0.1, docs/13-api-design.md. */
export interface PermissionResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export function toPermissionResponse(
  permission: Permission,
): PermissionResponseDto {
  return {
    id: permission.id,
    code: permission.code,
    name: permission.name,
    description: permission.description,
  };
}

/**
 * PUT /account/:id/permission trả về "danh sách Permission hiện tại của tài
 * khoản kèm trạng thái bật/tắt" (Mục 2, docs/13) — mở rộng thêm is_granted
 * so với đối tượng Permission gốc.
 */
export interface AccountPermissionGrantDto extends PermissionResponseDto {
  is_granted: boolean;
}

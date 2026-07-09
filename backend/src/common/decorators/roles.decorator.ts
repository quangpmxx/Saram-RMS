import { SetMetadata } from '@nestjs/common';
import { AccountRole } from '../../../generated/prisma/enums';

export const ROLES_KEY = 'roles';

/**
 * Giới hạn 1 route theo vai trò — đối chiếu đúng bảng quyền
 * Mục 8, docs/09-business-specification.md.
 */
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);

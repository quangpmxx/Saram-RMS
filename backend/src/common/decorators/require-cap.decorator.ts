import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CAP_KEY = 'requireCap';

/**
 * Phân quyền chi tiết (2026-11-07): route cần quyền nhỏ `code` (xem
 * capability-catalog.ts). Gắn ở method ghi đè gắn ở class. CapabilityGuard kiểm.
 */
export const RequireCap = (code: string) => SetMetadata(REQUIRE_CAP_KEY, code);

export const ALLOW_WITHOUT_MODULE_KEY = 'allowWithoutModule';

/**
 * Route dùng chung cho trang khác (vd danh mục Nguồn MKT ở form thêm data,
 * khối Chi phí Marketing ở Dashboard) — ModulePermissionGuard bỏ qua mức
 * truy cập của module chứa controller; quyền kiểm bằng @RequireCap nếu có.
 */
export const AllowWithoutModule = () =>
  SetMetadata(ALLOW_WITHOUT_MODULE_KEY, true);

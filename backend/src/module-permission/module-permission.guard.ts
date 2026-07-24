import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ModulePermissionService } from './module-permission.service';
import { findModuleByController } from './module-registry';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): "Phân quyền" phiên bản đơn giản — Guard TOÀN CỤC (đăng ký ở
 * app.module.ts, chạy SAU JwtAuthGuard/RolesGuard). Tra `context.getClass()`
 * trong MODULE_REGISTRY — controller KHÔNG có trong registry (chưa migrate
 * sang hệ thống mới) thì cho qua thẳng, không ảnh hưởng gì (Mục "giữ
 * nguyên toàn bộ chức năng hiện có ngoài phạm vi phân quyền").
 *
 * QUAN TRỌNG (theo đúng phản hồi trực tiếp người dùng — "vẫn giữ nguyên
 * nghiệp vụ riêng của Sale/MKT, vd chỉ MKT được up data mới"): Guard này
 * CHỈ THÊM giới hạn (NONE chặn hẳn, VIEW ép chỉ đọc), KHÔNG BAO GIỜ cấp
 * thêm quyền vượt quá logic nghiệp vụ chi tiết đã có sẵn trong từng
 * service (vd RolesGuard/@Roles('mkt','admin') ở POST /candidate vẫn chạy
 * bình thường, không bị guard này bỏ qua). 'edit' nghĩa là "không bị hệ
 * thống phân quyền module chặn thêm" — không phải "được làm mọi thứ".
 */
@Injectable()
export class ModulePermissionGuard implements CanActivate {
  constructor(
    private readonly modulePermissionService: ModulePermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleEntry = findModuleByController(context.getClass());
    if (!moduleEntry) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    // JwtAuthGuard (chạy trước) đã chặn request chưa đăng nhập ở mọi route
    // không @Public() — module trong registry không có route @Public()
    // nào, nhưng phòng hờ vẫn cho qua nếu vì lý do gì đó chưa có user
    // (không phải phạm vi guard này xử lý).
    if (!user) return true;

    const level = await this.modulePermissionService.getEffective(
      user.id,
      user.role,
      moduleEntry.code,
    );

    if (level === 'none') {
      throw new ForbiddenException(
        `Bạn không có quyền truy cập chức năng "${moduleEntry.label}"`,
      );
    }
    if (level === 'view' && !READ_ONLY_METHODS.has(request.method)) {
      throw new ForbiddenException(
        `Bạn chỉ có quyền xem "${moduleEntry.label}", không thể chỉnh sửa`,
      );
    }
    return true;
  }
}

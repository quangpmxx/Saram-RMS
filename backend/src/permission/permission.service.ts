import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PermissionResponseDto,
  toPermissionResponse,
} from './dto/permission-response.dto';

/**
 * Mục 2, docs/13-api-design.md — GET /permission. Danh mục quyền đã seed 5
 * quyền tạm ở Phase 9 (xem seedPhase9Permissions() trong seed.ts và ghi chú
 * tại prisma/schema.prisma + README) — chưa phải danh sách chính thức từ
 * chủ doanh nghiệp thật, có thể điều chỉnh sau theo đúng cảnh báo của
 * docs/14-roadmap.md (Phase 9).
 */
@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PermissionResponseDto[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
    return permissions.map(toPermissionResponse);
  }
}

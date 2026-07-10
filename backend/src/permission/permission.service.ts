import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PermissionResponseDto,
  toPermissionResponse,
} from './dto/permission-response.dto';

/**
 * Mục 2, docs/13-api-design.md — GET /permission. Danh mục quyền cố tình
 * RỖNG (xem ghi chú tại prisma/schema.prisma và README) — chờ xác nhận danh
 * sách quyền cụ thể từ chủ doanh nghiệp theo đúng cảnh báo của
 * docs/14-roadmap.md (Phase 9), không tự suy đoán.
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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mục 9, docs/13-api-design.md — GET /lead-source */
  async listLeadSources(): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.leadSource.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}

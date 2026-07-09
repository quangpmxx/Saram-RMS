import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusCategory } from '../../generated/prisma/enums';

export interface StatusCatalogItem {
  id: string;
  category: string;
  code: string;
  name: string;
  sort_order: number;
}

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

  /** Mục 9, docs/13-api-design.md — GET /status (query: category). */
  async listStatusCatalog(
    category?: StatusCategory,
  ): Promise<StatusCatalogItem[]> {
    const entries = await this.prisma.statusCatalog.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    return entries.map((entry) => ({
      id: entry.id,
      category: entry.category,
      code: entry.code,
      name: entry.name,
      sort_order: entry.sortOrder,
    }));
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WebsiteJob, WebsitePost } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListWebsitePostsQueryDto,
  SaveWebsiteJobDto,
  SaveWebsitePostDto,
} from './dto/website-content.dto';

/** "Công nhân Goertek Bắc Ninh" → "cong-nhan-goertek-bac-ninh" */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'tin'
  );
}

const jobResponse = (j: WebsiteJob) => ({
  id: j.id,
  slug: j.slug,
  title: j.title,
  company: j.company,
  area: j.area,
  salary: j.salary,
  shift: j.shift,
  description: j.description,
  image: j.image,
  urgent: j.urgent,
  published: j.published,
  sort_order: j.sortOrder,
  created_at: j.createdAt,
  updated_at: j.updatedAt,
});

const postResponse = (p: WebsitePost) => ({
  id: p.id,
  slug: p.slug,
  kind: p.kind,
  title: p.title,
  summary: p.summary,
  body: p.body,
  cover: p.cover,
  images: Array.isArray(p.images) ? (p.images as string[]) : [],
  published: p.published,
  published_at: p.publishedAt,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

/**
 * Tin việc làm + tin tức/album trên trang web (2026-11-18).
 * Đọc công khai chỉ thấy tin đã đăng; quản lý (thêm/sửa/xoá, xem cả bản nháp) thuộc module quyền "website".
 */
@Injectable()
export class WebsiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Đường dẫn chưa ai dùng: thêm -2, -3… nếu trùng. */
  private async uniqueSlug(
    title: string,
    exists: (slug: string) => Promise<boolean>,
  ): Promise<string> {
    const base = slugify(title);
    for (let n = 1; n < 200; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      if (!(await exists(slug))) return slug;
    }
    throw new BadRequestException('Không tạo được đường dẫn cho tin này');
  }

  /* ---------- Việc làm ---------- */

  async listJobs(includeDrafts: boolean) {
    const rows = await this.prisma.websiteJob.findMany({
      where: includeDrafts ? undefined : { published: true },
      orderBy: [
        { urgent: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    return rows.map(jobResponse);
  }

  async getJob(slug: string, includeDrafts: boolean) {
    const job = await this.prisma.websiteJob.findUnique({ where: { slug } });
    if (!job || (!includeDrafts && !job.published)) {
      throw new NotFoundException('Không tìm thấy tin việc làm');
    }
    return jobResponse(job);
  }

  async createJob(dto: SaveWebsiteJobDto, accountId: string) {
    if (!dto.title) throw new BadRequestException('Vui lòng nhập tên việc');
    const slug = await this.uniqueSlug(dto.title, async (s) =>
      Boolean(await this.prisma.websiteJob.findUnique({ where: { slug: s } })),
    );
    const job = await this.prisma.websiteJob.create({
      data: {
        slug,
        title: dto.title,
        company: dto.company ?? null,
        area: dto.area ?? null,
        salary: dto.salary ?? null,
        shift: dto.shift ?? null,
        description: dto.description ?? null,
        image: dto.image ?? null,
        urgent: dto.urgent ?? false,
        published: dto.published ?? false,
        sortOrder: dto.sort_order ?? 0,
        createdById: accountId,
        updatedById: accountId,
      },
    });
    return jobResponse(job);
  }

  async updateJob(id: string, dto: SaveWebsiteJobDto, accountId: string) {
    await this.ensureJob(id);
    const job = await this.prisma.websiteJob.update({
      where: { id },
      data: {
        title: dto.title,
        company: dto.company,
        area: dto.area,
        salary: dto.salary,
        shift: dto.shift,
        description: dto.description,
        image: dto.image,
        urgent: dto.urgent,
        published: dto.published,
        sortOrder: dto.sort_order,
        updatedById: accountId,
      },
    });
    return jobResponse(job);
  }

  async deleteJob(id: string) {
    await this.ensureJob(id);
    await this.prisma.websiteJob.delete({ where: { id } });
    return { deleted: id };
  }

  private async ensureJob(id: string) {
    const job = await this.prisma.websiteJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Không tìm thấy tin việc làm');
    return job;
  }

  /* ---------- Tin tức / album ---------- */

  async listPosts(query: ListWebsitePostsQueryDto, includeDrafts: boolean) {
    const rows = await this.prisma.websitePost.findMany({
      where: {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(includeDrafts ? {} : { published: true }),
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(postResponse);
  }

  async getPost(slug: string, includeDrafts: boolean) {
    const post = await this.prisma.websitePost.findUnique({ where: { slug } });
    if (!post || (!includeDrafts && !post.published)) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    return postResponse(post);
  }

  async createPost(dto: SaveWebsitePostDto, accountId: string) {
    if (!dto.title) throw new BadRequestException('Vui lòng nhập tiêu đề');
    const slug = await this.uniqueSlug(dto.title, async (s) =>
      Boolean(await this.prisma.websitePost.findUnique({ where: { slug: s } })),
    );
    const published = dto.published ?? false;
    const post = await this.prisma.websitePost.create({
      data: {
        slug,
        kind: dto.kind ?? 'news',
        title: dto.title,
        summary: dto.summary ?? null,
        body: dto.body ?? null,
        cover: dto.cover ?? null,
        images: dto.images ?? [],
        published,
        publishedAt: published ? new Date() : null,
        createdById: accountId,
        updatedById: accountId,
      },
    });
    return postResponse(post);
  }

  async updatePost(id: string, dto: SaveWebsitePostDto, accountId: string) {
    const current = await this.prisma.websitePost.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy bài viết');
    // Lần đầu đăng → ghi ngày đăng (giữ nguyên ngày cũ nếu đăng lại).
    const publishedAt =
      dto.published && !current.publishedAt ? new Date() : undefined;
    const post = await this.prisma.websitePost.update({
      where: { id },
      data: {
        kind: dto.kind,
        title: dto.title,
        summary: dto.summary,
        body: dto.body,
        cover: dto.cover,
        images: dto.images,
        published: dto.published,
        publishedAt,
        updatedById: accountId,
      },
    });
    return postResponse(post);
  }

  async deletePost(id: string) {
    const current = await this.prisma.websitePost.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy bài viết');
    await this.prisma.websitePost.delete({ where: { id } });
    return { deleted: id };
  }
}

import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsiteContentService, slugify } from './website-content.service';

describe('WebsiteContentService', () => {
  let prisma: {
    websiteJob: Record<
      'findMany' | 'findUnique' | 'create' | 'update' | 'delete',
      jest.Mock
    >;
    websitePost: Record<
      'findMany' | 'findUnique' | 'create' | 'update' | 'delete',
      jest.Mock
    >;
  };
  let service: WebsiteContentService;
  const mk = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn((a: { data: object }) =>
      Promise.resolve({ id: 'n', images: [], ...a.data }),
    ),
    update: jest.fn((a: { data: object }) =>
      Promise.resolve({ id: 'n', images: [], ...a.data }),
    ),
    delete: jest.fn(),
  });

  beforeEach(() => {
    prisma = { websiteJob: mk(), websitePost: mk() };
    service = new WebsiteContentService(prisma as unknown as PrismaService);
  });

  it('slugify bỏ dấu tiếng Việt', () => {
    expect(slugify('Công nhân Goertek — Bắc Ninh (ca đêm)')).toBe(
      'cong-nhan-goertek-bac-ninh-ca-dem',
    );
    expect(slugify('!!!')).toBe('tin');
  });

  it('createJob: đường dẫn trùng thì thêm -2; mặc định là bản nháp', async () => {
    prisma.websiteJob.findUnique.mockImplementation(
      ({ where }: { where: { slug: string } }) =>
        Promise.resolve(where.slug === 'tho-han' ? { id: 'x' } : null),
    );
    const job = await service.createJob({ title: 'Thợ hàn' }, 'acc');
    expect(job.slug).toBe('tho-han-2');
    expect(job.published).toBe(false);
  });

  it('listJobs công khai chỉ lấy tin đã đăng', async () => {
    await service.listJobs(false);
    expect(prisma.websiteJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { published: true } }),
    );
    await service.listJobs(true);
    expect(prisma.websiteJob.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('getJob: tin nháp không xem được khi công khai', async () => {
    prisma.websiteJob.findUnique.mockResolvedValue({
      id: 'j',
      slug: 's',
      published: false,
    });
    await expect(service.getJob('s', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getJob('s', true)).resolves.toMatchObject({
      slug: 's',
    });
  });

  it('updatePost: lần đầu đăng thì ghi ngày đăng, đăng lại giữ ngày cũ', async () => {
    prisma.websitePost.findUnique.mockResolvedValueOnce({
      id: 'p',
      publishedAt: null,
    });
    await service.updatePost('p', { published: true }, 'acc');
    expect(
      prisma.websitePost.update.mock.calls[0][0].data.publishedAt,
    ).toBeInstanceOf(Date);

    prisma.websitePost.findUnique.mockResolvedValueOnce({
      id: 'p',
      publishedAt: new Date(2020, 0, 1),
    });
    await service.updatePost('p', { published: true }, 'acc');
    expect(
      prisma.websitePost.update.mock.calls[1][0].data.publishedAt,
    ).toBeUndefined();
  });

  it('deleteJob / deletePost: không có thì báo không tìm thấy', async () => {
    await expect(service.deleteJob('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.deletePost('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

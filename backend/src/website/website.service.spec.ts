import { BadRequestException } from '@nestjs/common';
import { WebsiteService } from './website.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WebsiteService', () => {
  let prisma: {
    websiteText: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: WebsiteService;

  beforeEach(() => {
    prisma = {
      websiteText: {
        findMany: jest.fn(),
        upsert: jest.fn().mockReturnValue('op'),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new WebsiteService(prisma as unknown as PrismaService);
  });

  it('getTexts trả về dạng { mã: chữ }', async () => {
    prisma.websiteText.findMany.mockResolvedValue([
      { key: 'home.hero.title', value: 'Xin chào' },
    ]);
    await expect(service.getTexts()).resolves.toEqual({
      'home.hero.title': 'Xin chào',
    });
  });

  it('saveTexts upsert từng đoạn trong một giao dịch, ghi người sửa', async () => {
    await service.saveTexts(
      [
        { key: 'a.b', value: '1' },
        { key: 'c.d', value: '2' },
      ],
      'acc-1',
    );
    expect(prisma.websiteText.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.websiteText.upsert).toHaveBeenCalledWith({
      where: { key: 'a.b' },
      create: { key: 'a.b', value: '1', updatedById: 'acc-1' },
      update: { value: '1', updatedById: 'acc-1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(['op', 'op']);
  });

  it('saveTexts chặn mã trùng', async () => {
    await expect(
      service.saveTexts(
        [
          { key: 'a.b', value: '1' },
          { key: 'a.b', value: '2' },
        ],
        'acc-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('resetText xoá bản đã sửa; mã sai thì báo lỗi', async () => {
    await service.resetText('home.hero.title');
    expect(prisma.websiteText.deleteMany).toHaveBeenCalledWith({
      where: { key: 'home.hero.title' },
    });
    await expect(service.resetText('../x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

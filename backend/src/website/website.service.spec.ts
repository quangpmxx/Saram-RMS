import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WebsiteService } from './website.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WebsiteService', () => {
  let tx: {
    websiteText: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
    websiteTextHistory: { createMany: jest.Mock; create: jest.Mock };
  };
  let prisma: {
    websiteText: { findMany: jest.Mock };
    websiteTextHistory: { findMany: jest.Mock; findUnique: jest.Mock };
    account: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: WebsiteService;

  beforeEach(() => {
    tx = {
      websiteText: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      websiteTextHistory: { createMany: jest.fn(), create: jest.fn() },
    };
    prisma = {
      websiteText: { findMany: jest.fn() },
      websiteTextHistory: { findMany: jest.fn(), findUnique: jest.fn() },
      account: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
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

  it('saveTexts chỉ ghi + ghi lịch sử chỗ thật sự đổi, có người sửa', async () => {
    tx.websiteText.findMany.mockResolvedValue([{ key: 'c.d', value: '2' }]);
    await service.saveTexts(
      [
        { key: 'a.b', value: '1' },
        { key: 'c.d', value: '2' },
      ],
      'acc-1',
    );
    expect(tx.websiteText.upsert).toHaveBeenCalledTimes(1);
    expect(tx.websiteText.upsert).toHaveBeenCalledWith({
      where: { key: 'a.b' },
      create: { key: 'a.b', value: '1', updatedById: 'acc-1' },
      update: { value: '1', updatedById: 'acc-1' },
    });
    expect(tx.websiteTextHistory.createMany).toHaveBeenCalledWith({
      data: [{ key: 'a.b', oldValue: null, newValue: '1', accountId: 'acc-1' }],
    });
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

  it('resetText xoá bản đã sửa + ghi lịch sử; mã sai thì báo lỗi', async () => {
    tx.websiteText.findUnique.mockResolvedValue({
      key: 'home.hero.title',
      value: 'Cũ',
    });
    await service.resetText('home.hero.title', 'acc-1');
    expect(tx.websiteText.delete).toHaveBeenCalledWith({
      where: { key: 'home.hero.title' },
    });
    expect(tx.websiteTextHistory.create).toHaveBeenCalledWith({
      data: {
        key: 'home.hero.title',
        oldValue: 'Cũ',
        newValue: null,
        accountId: 'acc-1',
      },
    });
    await expect(service.resetText('../x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resetText khi chưa có bản sửa: không làm gì', async () => {
    tx.websiteText.findUnique.mockResolvedValue(null);
    await service.resetText('a.b');
    expect(tx.websiteText.delete).not.toHaveBeenCalled();
    expect(tx.websiteTextHistory.create).not.toHaveBeenCalled();
  });

  it('restoreHistory: giá trị cũ null → về bản gốc; có giá trị → lưu lại', async () => {
    prisma.websiteTextHistory.findUnique.mockResolvedValueOnce({
      key: 'a.b',
      oldValue: null,
    });
    tx.websiteText.findUnique.mockResolvedValue({ key: 'a.b', value: 'x' });
    await service.restoreHistory('h1', 'acc-1');
    expect(tx.websiteText.delete).toHaveBeenCalled();

    prisma.websiteTextHistory.findUnique.mockResolvedValueOnce({
      key: 'a.b',
      oldValue: 'cũ',
    });
    await service.restoreHistory('h2', 'acc-1');
    expect(tx.websiteText.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { value: 'cũ', updatedById: 'acc-1' },
      }),
    );

    prisma.websiteTextHistory.findUnique.mockResolvedValueOnce(null);
    await expect(service.restoreHistory('h3', 'acc-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

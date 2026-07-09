import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Prisma 7 yêu cầu driver adapter tường minh cho PostgreSQL thay vì chỉ
 * truyền datasource url — xem https://pris.ly/d/prisma7-client-config.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    // DATABASE_POOL_MAX: giới hạn số kết nối đồng thời tới Postgres. Cần đặt
    // =1 khi chạy bằng "npx prisma dev" (PGlite nhúng) — engine này xử lý
    // từng câu lệnh một, nhiều request chạy song song (vd. Promise.all ở
    // Server Component) có thể làm 1 kết nối vừa được cấp lại bị dùng chồng,
    // khiến NestJS trả về 401/500 dù phiên đăng nhập vẫn hợp lệ. Không giới
    // hạn (undefined) khi dùng Postgres thật (Docker/production) để giữ
    // nguyên hiệu năng pool mặc định.
    const poolMax = configService.get<string>('DATABASE_POOL_MAX');
    const adapter = new PrismaPg({
      connectionString: configService.getOrThrow<string>('DATABASE_URL'),
      ...(poolMax ? { max: Number(poolMax) } : {}),
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

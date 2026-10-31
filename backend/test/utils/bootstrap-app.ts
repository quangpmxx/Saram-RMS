import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

/** Dựng app y hệt main.ts để test e2e phản ánh đúng hành vi thật. */
export async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Các test đăng nhập bằng mật khẩu cố định "123456". Nếu DEFAULT_PASSWORD
  // (mật khẩu mặc định của hệ thống) cũng là "123456" thì mọi tài khoản test bị
  // bắt đổi mật khẩu (rà soát 2026-10-30, B8) và hàng loạt test fail 403 khó hiểu.
  const defaultPassword = moduleFixture
    .get(ConfigService)
    .get<string>('DEFAULT_PASSWORD');
  if (defaultPassword === '123456') {
    throw new Error(
      'Chạy e2e cần đặt DEFAULT_PASSWORD khác 123456 (vd DEFAULT_PASSWORD=E2e-Not-Default-9) và dùng database sạch.',
    );
  }

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  return app;
}

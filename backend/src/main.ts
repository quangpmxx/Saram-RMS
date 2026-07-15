import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  // Dự án phụ — nâng cấp toàn diện (2026-07-15, module Check in GPS — Phase
  // 3, Mục 5, yêu cầu người dùng: "Backend phải lấy IP từ request và xử lý
  // đúng trường hợp proxy"): tin CHỈ 1 hop proxy phía trước (an toàn mặc
  // định cho triển khai sau 1 reverse proxy như nginx) — `req.ip` khi đó ưu
  // tiên header X-Forwarded-For do proxy đó set, không tin chuỗi
  // X-Forwarded-For client tự gửi vô hạn hop như "trust proxy: true".
  app.set('trust proxy', 1);

  // Dự án phụ — ảnh đại diện tự upload (POST /me/avatar). Đảm bảo thư mục
  // tồn tại trước khi multer ghi file vào đó, rồi phục vụ tĩnh qua "/uploads".
  const avatarsDir = join(process.cwd(), 'uploads', 'avatars');
  if (!existsSync(avatarsDir)) {
    mkdirSync(avatarsDir, { recursive: true });
  }
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Không thể khởi động ứng dụng:', error);
  process.exit(1);
});

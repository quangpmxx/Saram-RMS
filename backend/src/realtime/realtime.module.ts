import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/**
 * Đăng ký JwtModule RIÊNG (không import AuthModule) — AuthModule không
 * export JwtModule, và tự đăng ký ở đây giữ RealtimeModule độc lập, không
 * tạo phụ thuộc vòng nếu sau này AuthModule cần dùng lại tính năng realtime.
 * Cùng JWT_SECRET với AuthModule (đọc chung 1 biến môi trường) nên verify
 * đúng access_token đã ký ở luồng đăng nhập HTTP.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}

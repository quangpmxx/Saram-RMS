import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { TeamsModule } from './teams/teams.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ImportsModule } from './imports/imports.module';
import { CatalogModule } from './catalog/catalog.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    AccountsModule,
    TeamsModule,
    CandidatesModule,
    ImportsModule,
    CatalogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Mặc định yêu cầu đăng nhập cho mọi route (trừ @Public()), sau đó kiểm
    // tra vai trò (@Roles()) — áp dụng toàn cục để không route nào bị quên
    // gắn guard. Thứ tự chạy theo thứ tự khai báo: JwtAuthGuard trước.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

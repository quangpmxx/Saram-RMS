import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { comparePassword } from '../common/utils/password.util';
import {
  AccountResponseDto,
  toAccountResponse,
} from '../accounts/dto/account-response.dto';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';

export interface LoginResult {
  token: string;
  account: AccountResponseDto;
}

const TEAM_SELECT = { id: true, name: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLog: AuditLogService,
  ) {}

  async login(
    dto: LoginDto,
    deviceInfo: string | undefined,
  ): Promise<LoginResult> {
    const account = await this.prisma.account.findUnique({
      where: { username: dto.username },
      include: { team: { select: TEAM_SELECT } },
    });

    // Không tiết lộ tài khoản có tồn tại hay không qua nội dung lỗi.
    if (!account || account.status === 'inactive') {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const passwordMatches = await comparePassword(
      dto.password,
      account.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    // Mục 8, docs/09: cho phép đăng nhập nhiều thiết bị cùng lúc — mỗi lần
    // đăng nhập tạo 1 session mới, không thu hồi các session khác.
    const session = await this.prisma.session.create({
      data: { accountId: account.id, deviceInfo: deviceInfo?.slice(0, 255) },
    });

    const payload: JwtPayload = {
      sub: account.id,
      role: account.role,
      sessionId: session.id,
    };
    const token = await this.jwtService.signAsync(payload);

    await this.auditLog.log({
      accountId: account.id,
      actionType: 'login',
      entityType: 'account',
      entityId: account.id,
    });

    return { token, account: toAccountResponse(account) };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.prisma.session.update({
      where: { id: user.sessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditLog.log({
      accountId: user.id,
      actionType: 'logout',
      entityType: 'account',
      entityId: user.id,
    });
  }

  async me(userId: string): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: userId },
      include: { team: { select: TEAM_SELECT } },
    });

    if (!account) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    return toAccountResponse(account);
  }
}

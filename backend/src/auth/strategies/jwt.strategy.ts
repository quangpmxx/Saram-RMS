import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../common/interfaces/jwt-payload.interface';

function cookieExtractor(req: Request): string | null {
  const cookies = req?.cookies as Record<string, string> | undefined;
  return cookies?.['access_token'] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã kết thúc, vui lòng đăng nhập lại',
      );
    }

    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });
    if (!account || account.status === 'inactive') {
      throw new UnauthorizedException('Tài khoản không còn hoạt động');
    }

    // Cập nhật hoạt động gần nhất của phiên — không chặn request nếu ghi thất bại.
    void this.prisma.session
      .update({ where: { id: session.id }, data: { lastActiveAt: new Date() } })
      .catch(() => undefined);

    return { id: account.id, role: account.role, sessionId: session.id };
  }
}

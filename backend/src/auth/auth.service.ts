import { unlink } from 'fs/promises';
import { join } from 'path';
import {
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { comparePassword, hashPassword } from '../common/utils/password.util';
import {
  AccountResponseDto,
  toAccountResponse,
} from '../accounts/dto/account-response.dto';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface LoginResult {
  token: string;
  account: AccountResponseDto;
}

const TEAM_SELECT = { id: true, name: true } as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

  /**
   * Dự án phụ — nâng cấp toàn diện: PUT /me/password. Mọi vai trò tự đổi
   * mật khẩu của chính mình (khác với reset-password Admin-only trả về mặc
   * định). Không thu hồi session hiện tại/các session khác sau khi đổi
   * thành công — giữ nguyên đăng nhập (yêu cầu tường minh của tính năng).
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    if (dto.new_password !== dto.confirm_password) {
      throw new UnprocessableEntityException(
        'Mật khẩu mới và xác nhận mật khẩu không khớp',
      );
    }

    const account = await this.prisma.account.findUnique({
      where: { id: userId },
    });
    if (!account) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    const currentMatches = await comparePassword(
      dto.current_password,
      account.passwordHash,
    );
    if (!currentMatches) {
      throw new UnprocessableEntityException('Mật khẩu hiện tại không đúng');
    }

    const passwordHash = await hashPassword(dto.new_password);
    await this.prisma.account.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.auditLog.log({
      accountId: userId,
      actionType: 'update',
      entityType: 'account',
      entityId: userId,
      fieldChanged: 'password',
    });
  }

  /**
   * Dự án phụ — nâng cấp toàn diện: POST /me/avatar. `avatarPath` là đường
   * dẫn tương đối đã lưu qua multer (vd "/uploads/avatars/xxx.jpg"), được
   * phục vụ tĩnh qua useStaticAssets() trong main.ts. Dọn file ảnh cũ theo
   * kiểu best-effort (không chặn request nếu xóa thất bại).
   */
  async updateAvatar(
    userId: string,
    avatarPath: string,
  ): Promise<AccountResponseDto> {
    const existing = await this.prisma.account.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    const updated = await this.prisma.account.update({
      where: { id: userId },
      data: { avatarUrl: avatarPath },
      include: { team: { select: TEAM_SELECT } },
    });

    if (existing.avatarUrl && existing.avatarUrl !== avatarPath) {
      const oldFilePath = join(
        process.cwd(),
        existing.avatarUrl.replace(/^\//, ''),
      );
      unlink(oldFilePath).catch((error: unknown) => {
        this.logger.warn(
          `Không xóa được ảnh đại diện cũ "${oldFilePath}": ${String(error)}`,
        );
      });
    }

    await this.auditLog.log({
      accountId: userId,
      actionType: 'update',
      entityType: 'account',
      entityId: userId,
      fieldChanged: 'avatar_url',
    });

    return toAccountResponse(updated);
  }
}

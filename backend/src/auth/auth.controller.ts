import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { ACCESS_TOKEN_COOKIE, buildCookieOptions } from './auth-cookie.util';

/** Dự án phụ — nâng cấp toàn diện: ảnh đại diện tự upload (POST /me/avatar). */
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Mục 1, docs/13-api-design.md — POST /login, POST /logout, GET /me.
 * Dự án phụ (nâng cấp toàn diện, ngoài phạm vi Design Freeze docs/09-13):
 * PUT /me/password, POST /me/avatar — tự phục vụ, mọi vai trò đã đăng nhập
 * đều gọi được (không @Roles()), khác hẳn AccountsController (Admin-only).
 */
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, account } = await this.authService.login(
      dto,
      req.headers['user-agent'],
    );
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      token,
      buildCookieOptions(this.configService),
    );
    return { account };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user);
    res.clearCookie(
      ACCESS_TOKEN_COOKIE,
      buildCookieOptions(this.configService),
    );
    return { message: 'Đăng xuất thành công' };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Put('me/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authService.changePassword(user.id, dto);
    return { message: 'Đã đổi mật khẩu thành công' };
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'avatars'),
        filename: (_req, file, callback) => {
          callback(
            null,
            `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: { fileSize: AVATAR_MAX_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'Chỉ chấp nhận ảnh định dạng JPEG, PNG hoặc WebP',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn ảnh đại diện');
    }
    return this.authService.updateAvatar(
      user.id,
      `/uploads/avatars/${file.filename}`,
    );
  }
}

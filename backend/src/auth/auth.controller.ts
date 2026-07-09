import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { ACCESS_TOKEN_COOKIE, buildCookieOptions } from './auth-cookie.util';

/** Mục 1, docs/13-api-design.md — POST /login, POST /logout, GET /me */
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
}

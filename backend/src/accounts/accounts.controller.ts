import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { UpdateAccountPermissionDto } from './dto/update-account-permission.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/** Mục 2, docs/13-api-design.md — toàn bộ endpoint /account chỉ dành cho Admin. */
@Controller('account')
@Roles('admin')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  list(@Query() query: ListAccountsQueryDto) {
    return this.accountsService.list(query);
  }

  @Post()
  create(
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accountsService.deactivate(id, user.id);
    return { message: 'Đã vô hiệu hóa tài khoản' };
  }

  /** Yêu cầu trực tiếp người dùng (2026-07-15): xóa vĩnh viễn — KHÁC deactivate() ở trên (khóa tài khoản). */
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  async deletePermanently(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accountsService.deletePermanently(id, user.id);
    return { message: 'Đã xóa vĩnh viễn tài khoản' };
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accountsService.resetPassword(id, user.id);
    return { message: 'Đã đặt lại mật khẩu về mặc định' };
  }

  @Put(':id/permission')
  updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.updatePermissions(id, dto, user.id);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { join } from 'path';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { SaveWebsiteTextsDto } from './dto/save-website-texts.dto';
import { WebsiteService } from './website.service';
import { WebsiteFormsService } from './website-forms.service';
import {
  BusinessContactDto,
  ListWebsiteContactsQueryDto,
  RegisterWorkerDto,
  UpdateWebsiteContactDto,
} from './dto/website-forms.dto';
import type { Request } from 'express';

/** Ảnh trang web: lưu ở uploads/website, phục vụ tĩnh qua /uploads (main.ts). */
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Trang web công ty đọc chữ/ảnh đã sửa — công khai, không cần đăng nhập. Không nằm trong module-registry. */
@Controller('website')
export class WebsitePublicController {
  constructor(
    private readonly websiteService: WebsiteService,
    private readonly forms: WebsiteFormsService,
  ) {}

  @Public()
  @Get('texts')
  getTexts() {
    return this.websiteService.getTexts();
  }

  /** Form "Đăng ký tìm việc" → data nguồn Website trong CRM. */
  @Public()
  @Post('register-worker')
  @HttpCode(HttpStatus.OK)
  registerWorker(@Body() dto: RegisterWorkerDto, @Req() req: Request) {
    return this.forms.registerWorker(dto, req.ip ?? 'unknown');
  }

  /** Form "Gửi nhu cầu tuyển dụng" → danh sách Liên hệ từ website + báo chuông. */
  @Public()
  @Post('business-contact')
  @HttpCode(HttpStatus.OK)
  contactBusiness(@Body() dto: BusinessContactDto, @Req() req: Request) {
    return this.forms.contactBusiness(dto, req.ip ?? 'unknown');
  }
}

/** Trang "Liên hệ từ website" trong CRM — module quyền "website-contacts" (mặc định Admin + Quản lý). */
@Controller('website/contacts')
export class WebsiteContactsController {
  constructor(private readonly forms: WebsiteFormsService) {}

  @Get()
  list(@Query() query: ListWebsiteContactsQueryDto) {
    return this.forms.listContacts(query);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebsiteContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forms.updateContact(id, dto, user);
  }
}

/** Sửa chữ/ảnh trên trang web — quyền module "website" (trang Phân quyền), mặc định chỉ Admin. */
@Controller('website')
export class WebsiteTextController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Put('texts')
  @HttpCode(HttpStatus.OK)
  save(
    @Body() dto: SaveWebsiteTextsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.websiteService.saveTexts(dto.items, user.id);
  }

  @Delete('texts/:key')
  @HttpCode(HttpStatus.OK)
  reset(@Param('key') key: string) {
    return this.websiteService.resetText(key);
  }

  /** Tải ảnh mới lên; trả đường dẫn — trang web lưu đường dẫn này như một đoạn "chữ" khi bấm Lưu. */
  @Post('images')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'website'),
        filename: (_req, file, callback) => {
          callback(null, `${randomUUID()}${IMAGE_EXT[file.mimetype]}`);
        },
      }),
      limits: { fileSize: IMAGE_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!IMAGE_EXT[file.mimetype]) {
          callback(
            new BadRequestException(
              'Chỉ nhận ảnh định dạng JPEG, PNG hoặc WebP',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh');
    return { url: `/uploads/website/${file.filename}` };
  }
}

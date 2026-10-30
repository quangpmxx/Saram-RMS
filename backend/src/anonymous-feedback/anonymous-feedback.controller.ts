import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  AnonymousFeedbackService,
  FEEDBACK_MAX_IMAGE_BYTES,
  FEEDBACK_MAX_IMAGES,
} from './anonymous-feedback.service';
import { CreateAnonymousFeedbackDto } from './dto/create-anonymous-feedback.dto';
import { ListAnonymousFeedbackQueryDto } from './dto/list-anonymous-feedback-query.dto';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Đơn phản ánh ẩn danh (2026-10-28). KHÔNG đăng ký vào module-registry.ts:
 * MỌI nhân viên được gửi (kể cả vai trò không vào được trang Chấm công) —
 * gate theo module sẽ chặn nhầm. Quyền theo vai trò kiểm tra trong service.
 */
@Controller('anonymous-feedback')
export class AnonymousFeedbackController {
  constructor(private readonly service: AnonymousFeedbackService) {}

  /** Multipart: subject, content, recipient_ids (JSON) + tối đa 5 ảnh ở field "images". */
  @Post()
  @UseInterceptors(
    // Giới hạn rộng hơn 5 để quá số ảnh được service báo lỗi tiếng Việt
    // (multer tự chặn thì chỉ báo "Unexpected field").
    FilesInterceptor('images', FEEDBACK_MAX_IMAGES * 4, {
      storage: memoryStorage(),
      limits: { fileSize: FEEDBACK_MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
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
  create(
    @Body() dto: CreateAnonymousFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() images: Express.Multer.File[] | undefined,
  ) {
    return this.service.create(dto, user, images ?? []);
  }

  /** Admin/Quản lý đang hoạt động — để nhân viên chọn người nhận. */
  @Get('recipients')
  listRecipients() {
    return this.service.listRecipients();
  }

  @Get()
  list(
    @Query() query: ListAnonymousFeedbackQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.list(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Get(':id/images/:index')
  getImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getImage(id, index, user);
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { defaultErrorCode } from '../utils/error-code.util';

interface ErrorResponseBody {
  error_code: string;
  message: string;
}

/**
 * Chuẩn hóa mọi lỗi trả về theo đúng định dạng đã chốt tại
 * Mục 0, docs/13-api-design.md: { error_code, message }.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(this.normalize(status, body, exception.message));
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error_code: 'INTERNAL_ERROR',
      message: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
    });
  }

  private normalize(
    status: number,
    body: string | object,
    fallbackMessage: string,
  ): ErrorResponseBody {
    if (typeof body === 'string') {
      return { error_code: defaultErrorCode(status), message: body };
    }

    const obj = body as Record<string, unknown>;
    const message = Array.isArray(obj.message)
      ? obj.message.join('; ')
      : typeof obj.message === 'string'
        ? obj.message
        : fallbackMessage;
    const errorCode =
      typeof obj.error_code === 'string'
        ? obj.error_code
        : defaultErrorCode(status);

    return { error_code: errorCode, message };
  }
}

import { HttpStatus } from '@nestjs/common';

/**
 * Định dạng lỗi chung — Mục 0, docs/13-api-design.md:
 * "mã lỗi HTTP kèm error_code và message mô tả lý do".
 *
 * So sánh bằng số nguyên (không dùng trực tiếp case HttpStatus.XXX) vì
 * tham số đầu vào là `number` chung (lấy từ HttpException#getStatus()),
 * không phải kiểu enum HttpStatus.
 */
const STATUS_TO_CODE: ReadonlyMap<number, string> = new Map([
  [HttpStatus.BAD_REQUEST, 'BAD_REQUEST'],
  [HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED'],
  [HttpStatus.FORBIDDEN, 'FORBIDDEN'],
  [HttpStatus.NOT_FOUND, 'NOT_FOUND'],
  [HttpStatus.CONFLICT, 'CONFLICT'],
  [HttpStatus.UNPROCESSABLE_ENTITY, 'UNPROCESSABLE_ENTITY'],
]);

export function defaultErrorCode(status: number): string {
  const known = STATUS_TO_CODE.get(status);
  if (known) {
    return known;
  }
  return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
}

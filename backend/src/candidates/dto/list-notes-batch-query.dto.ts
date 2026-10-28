import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/**
 * GET /candidate/notes?ids=<uuid>,<uuid>,... — ghi chú của nhiều lead 1 lần
 * (tối đa 200 = page_size lớn nhất của danh sách). Nhận cả dạng
 * "ids=a,b,c" lẫn "ids=a&ids=b".
 */
export class ListNotesBatchQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    (Array.isArray(value) ? value : [value])
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean),
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids: string[];
}

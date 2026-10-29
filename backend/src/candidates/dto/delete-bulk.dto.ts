import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** POST /candidate/delete-bulk (body) — xoá mềm nhiều data đã tick chọn (tối đa 300 = 1 trang lớn nhất). */
export class DeleteBulkDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(300)
  @IsUUID('4', { each: true })
  candidate_ids: string[];
}

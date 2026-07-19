import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** DELETE /sales-entry/ds-sale — xóa nhiều dòng đã chọn (Mục 9, yêu cầu người dùng). */
export class BulkDeleteDsSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];
}

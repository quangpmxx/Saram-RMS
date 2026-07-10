import { IsNotEmpty, IsString } from 'class-validator';

/** Bổ sung "Chỉnh sửa" ghi chú — PUT /candidate/:id/note/:noteId (body). */
export class UpdateNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung ghi chú không được để trống' })
  content: string;
}

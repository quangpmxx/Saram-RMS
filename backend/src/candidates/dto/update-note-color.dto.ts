import { IsIn, IsOptional } from 'class-validator';
import { NoteColor } from '../../../generated/prisma/client';

const NOTE_COLORS: NoteColor[] = ['yellow', 'green', 'red'];

/**
 * Dự án phụ — nâng cấp toàn diện: PUT /candidate/:id/note-color (body).
 * note_color = null nghĩa là bỏ chọn màu (quay về mặc định).
 */
export class UpdateNoteColorDto {
  @IsOptional()
  @IsIn(NOTE_COLORS)
  note_color: NoteColor | null;
}

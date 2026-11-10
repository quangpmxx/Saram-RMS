import { IsOptional, IsString, MaxLength } from 'class-validator';

/** PUT /candidate/:id/quick-note — ô "Note" ngắn của data (2026-11-10). Rỗng/null = xoá. */
export class UpdateQuickNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Note tối đa 255 ký tự' })
  quick_note: string | null;
}

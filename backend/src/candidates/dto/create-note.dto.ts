import { IsNotEmpty, IsString } from 'class-validator';

/** Mục 6, docs/13-api-design.md — POST /candidate/:id/note (body). */
export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

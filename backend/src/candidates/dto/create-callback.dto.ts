import { IsDateString } from 'class-validator';

/** Mục 6, docs/13-api-design.md — POST /candidate/:id/callback (body). */
export class CreateCallbackDto {
  @IsDateString()
  scheduled_at: string;
}

import { IsDateString, IsIn, IsOptional } from 'class-validator';

/** Mục 6, docs/13-api-design.md — POST /candidate/:id/callback (body). */
export class CreateCallbackDto {
  @IsDateString()
  scheduled_at: string;

  /** "once" (mặc định) | "daily" — lặp mỗi ngày cùng giờ (yêu cầu người dùng 2026-10-29). */
  @IsOptional()
  @IsIn(['once', 'daily'])
  repeat?: 'once' | 'daily';
}

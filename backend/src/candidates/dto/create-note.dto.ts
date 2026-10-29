import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

/** Mục 6, docs/13-api-design.md — POST /candidate/:id/note (body). */
export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  /**
   * Tình trạng/kết quả cuộc gọi của CHÍNH lần chăm sóc này (yêu cầu người
   * dùng 2026-10-29) — gửi kèm thì ghi chú dùng đúng giá trị này (null = lần
   * này không chọn). Không gửi (undefined) thì giữ cách cũ: lấy giá trị hiện
   * tại của data.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  call_status_id?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  call_result_id?: string | null;
}

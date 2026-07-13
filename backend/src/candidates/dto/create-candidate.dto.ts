import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Mục 4, docs/13-api-design.md — POST /candidate */
export class CreateCandidateDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên lao động không được để trống' })
  @MaxLength(150)
  full_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @MaxLength(20)
  phone_number: string;

  @IsUUID('4', { message: 'source_id không hợp lệ' })
  source_id: string;

  /**
   * Dự án phụ — nâng cấp toàn diện: bắt buộc chọn nhóm ngay khi up data —
   * data thuộc nhóm nào thì CHỈ Leader/Sale nhóm đó thấy (Leader phân số
   * hoặc Sale tự nhận), thay cho "Chờ phân chia" hiện toàn hệ thống như cũ.
   */
  @IsUUID('4', { message: 'team_id không hợp lệ' })
  team_id: string;

  @IsOptional()
  @IsString()
  mkt_note?: string;
}

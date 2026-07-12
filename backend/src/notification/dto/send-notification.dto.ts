import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện: POST /notification (chỉ Admin) — soạn +
 * gửi thông báo trong ứng dụng (chuông/toast) cho 1 hoặc nhiều nhóm/tài
 * khoản cụ thể. target_type='team' → target_ids là danh sách team_id (gửi
 * cho toàn bộ thành viên đang active của các nhóm đó); target_type='account'
 * → target_ids là danh sách account_id cụ thể.
 */
export class SendNotificationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content: string;

  @IsIn(['team', 'account'])
  target_type: 'team' | 'account';

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  target_ids: string[];
}

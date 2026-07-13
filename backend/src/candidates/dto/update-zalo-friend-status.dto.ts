import { IsOptional, IsUUID } from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện: PUT /candidate/:id/zalo-friend-status
 * (body). zalo_friend_status_id = null nghĩa là bỏ chọn.
 */
export class UpdateZaloFriendStatusDto {
  @IsOptional()
  @IsUUID('4')
  zalo_friend_status_id: string | null;
}

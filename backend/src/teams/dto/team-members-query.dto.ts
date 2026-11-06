import { IsDateString, IsOptional } from 'class-validator';

/**
 * GET /team/:id/member (query) — khoảng "Ngày lên số" cho thanh "Khối lượng
 * công việc nhóm" (yêu cầu người dùng 2026-11-06): assigned_count chỉ đếm data
 * có ngày lên số trong khoảng này. Bỏ trống = không giới hạn.
 */
export class TeamMembersQueryDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

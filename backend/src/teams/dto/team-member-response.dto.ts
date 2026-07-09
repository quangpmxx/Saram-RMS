import { AccountResponseDto } from '../../accounts/dto/account-response.dto';

/**
 * Mục 3, docs/13-api-design.md — GET /team/:id/member.
 * `assigned_count` có dữ liệu thật từ Phase 2; `care_pool_count` luôn 0 cho
 * tới khi Phase 5 dựng cột chăm sóc (đúng nguyên tắc "cột rỗng tới đúng Phase").
 */
export interface TeamMemberResponseDto extends AccountResponseDto {
  assigned_count: number;
  care_pool_count: number;
}

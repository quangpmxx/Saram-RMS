import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

/**
 * Mục 5, docs/13-api-design.md — PUT /distribution-rule/:teamId.
 * "Request (body): danh sách account_id theo đúng thứ tự mong muốn" —
 * order_index của từng thành viên = vị trí trong mảng này.
 */
export class UpdateDistributionRuleDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true, message: 'account_ids chứa id không hợp lệ' })
  account_ids: string[];
}

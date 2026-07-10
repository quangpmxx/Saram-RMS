import { CandidateResponseDto } from './candidate-response.dto';

/**
 * Mục 2, docs/13-api-design.md — GET /candidate/duplicate: "danh sách nhóm
 * trùng, mỗi nhóm gồm phone_number + danh sách các đối tượng Candidate liên
 * quan" (khác với `DuplicateDetailDto` của GET /candidate/:id/duplicates,
 * vốn dùng dạng rút gọn `DuplicateDetailMatch`).
 */
export interface DuplicateGroupDto {
  phone_number: string;
  matches: CandidateResponseDto[];
}

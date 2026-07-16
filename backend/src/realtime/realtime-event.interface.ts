import { AccountRole } from '../../generated/prisma/client';
import { CandidateResponseDto } from '../candidates/dto/candidate-response.dto';
import { NoteResponseDto } from '../candidates/dto/note-response.dto';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — "Đồng bộ realtime module Data
 * lao động": danh sách đầy đủ loại thay đổi cần phát realtime, khớp đúng
 * Mục 1 bản yêu cầu (thêm/sửa/xóa note, đổi trạng thái cuộc gọi, sửa
 * trường được phép, chuyển Sale, thêm/gỡ người chăm sóc, và các thay đổi
 * khác ảnh hưởng dòng hiển thị).
 */
export type LeadChangeType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'assigned'
  | 'transferred'
  | 'held'
  | 'unheld'
  | 'note_created'
  | 'note_updated'
  | 'note_deleted'
  | 'care_pool_locked'
  | 'care_pool_released'
  | 'care_pool_removed'
  | 'care_pool_entered';

/**
 * Chỉ dùng NỘI BỘ ở server để tính phòng (room) cần phát tới — KHÔNG gửi
 * nguyên object này ra ngoài client (Mục 7: "không gửi toàn bộ dữ liệu
 * nhạy cảm nếu frontend chỉ cần một phần" — client chỉ cần payload event
 * bên dưới, không cần biết cơ chế định tuyến phòng).
 */
export interface LeadEventTargets {
  assignedTeamId: string | null;
  assignedToId?: string | null;
  carePoolLockedById?: string | null;
  /** Chỉ true cho lead THẬT SỰ chưa có nhóm (assignedTeamId=null) — Leader/Sale bất kỳ đều xem được (Mục 2, buildScopeWhere). */
  visibleToAllLeaderSale?: boolean;
}

/** Payload thật sự gửi cho client qua sự kiện `leads:update`. */
export interface LeadRealtimeEvent {
  lead_id: string;
  change_type: LeadChangeType;
  /** Bản ghi Candidate mới nhất — có ở mọi loại thay đổi TRỪ note_* thuần túy không đụng tới field nào của Lead (note_updated/note_deleted). */
  candidate?: CandidateResponseDto;
  /** Chỉ có ở 3 loại note_*. */
  note?: NoteResponseDto;
  updated_at: string;
  /** null nếu do hệ thống nền tự thực hiện (vd worker quét Cột chăm sóc). */
  actor: { id: string; role: AccountRole } | null;
}

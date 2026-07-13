import {
  Account,
  LeadNote,
  StatusCatalog,
} from '../../../generated/prisma/client';
import { NamedRefWithRole } from './candidate-response.dto';

/**
 * Đối tượng "Note" dùng chung — Mục 0.1, docs/13-api-design.md.
 * `created_by` kèm `role` (dự án phụ — nâng cấp toàn diện, bổ sung field):
 * "vai trò admin/quản lý/leader thì thao tác ở đâu cũng phải mở ngoặc vai
 * trò cạnh tên" — yêu cầu trực tiếp người dùng.
 */
export interface NoteResponseDto {
  id: string;
  lead_id: string;
  created_by: NamedRefWithRole;
  content: string;
  call_status: { id: string; name: string } | null;
  call_result: { id: string; name: string } | null;
  zalo_friend_status: { id: string; name: string } | null;
  created_at: string;
  is_deleted: boolean;
}

type NoteWithRelations = LeadNote & {
  createdBy: Pick<Account, 'id' | 'fullName' | 'role'>;
  callStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
  callResult?: Pick<StatusCatalog, 'id' | 'name'> | null;
  zaloFriendStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
};

export function toNoteResponse(note: NoteWithRelations): NoteResponseDto {
  return {
    id: note.id,
    lead_id: note.leadId,
    created_by: {
      id: note.createdBy.id,
      name: note.createdBy.fullName,
      role: note.createdBy.role,
    },
    content: note.content,
    call_status: note.callStatus
      ? { id: note.callStatus.id, name: note.callStatus.name }
      : null,
    call_result: note.callResult
      ? { id: note.callResult.id, name: note.callResult.name }
      : null,
    zalo_friend_status: note.zaloFriendStatus
      ? { id: note.zaloFriendStatus.id, name: note.zaloFriendStatus.name }
      : null,
    created_at: note.createdAt.toISOString(),
    is_deleted: note.isDeleted,
  };
}

export const NOTE_INCLUDE = {
  createdBy: { select: { id: true, fullName: true, role: true } },
  callStatus: { select: { id: true, name: true } },
  callResult: { select: { id: true, name: true } },
  zaloFriendStatus: { select: { id: true, name: true } },
} as const;

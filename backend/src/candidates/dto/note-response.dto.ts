import {
  Account,
  LeadNote,
  StatusCatalog,
} from '../../../generated/prisma/client';

/** Đối tượng "Note" dùng chung — Mục 0.1, docs/13-api-design.md. */
export interface NoteResponseDto {
  id: string;
  lead_id: string;
  created_by: { id: string; name: string };
  content: string;
  call_status: { id: string; name: string } | null;
  call_result: { id: string; name: string } | null;
  created_at: string;
  is_deleted: boolean;
}

type NoteWithRelations = LeadNote & {
  createdBy: Pick<Account, 'id' | 'fullName'>;
  callStatus?: Pick<StatusCatalog, 'id' | 'name'> | null;
  callResult?: Pick<StatusCatalog, 'id' | 'name'> | null;
};

export function toNoteResponse(note: NoteWithRelations): NoteResponseDto {
  return {
    id: note.id,
    lead_id: note.leadId,
    created_by: { id: note.createdBy.id, name: note.createdBy.fullName },
    content: note.content,
    call_status: note.callStatus
      ? { id: note.callStatus.id, name: note.callStatus.name }
      : null,
    call_result: note.callResult
      ? { id: note.callResult.id, name: note.callResult.name }
      : null,
    created_at: note.createdAt.toISOString(),
    is_deleted: note.isDeleted,
  };
}

export const NOTE_INCLUDE = {
  createdBy: { select: { id: true, fullName: true } },
  callStatus: { select: { id: true, name: true } },
  callResult: { select: { id: true, name: true } },
} as const;

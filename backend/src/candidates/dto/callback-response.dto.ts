import { Account, CallbackSchedule } from '../../../generated/prisma/client';
import { NamedRefWithRole } from './candidate-response.dto';

/** Đối tượng "Callback" dùng chung — Mục 0.1, docs/13-api-design.md. */
export interface CallbackResponseDto {
  id: string;
  lead_id: string;
  scheduled_at: string;
  is_completed: boolean;
  created_by: NamedRefWithRole;
  created_at: string;
}

type CallbackWithRelations = CallbackSchedule & {
  createdBy: Pick<Account, 'id' | 'fullName' | 'role' | 'avatarUrl'>;
};

export function toCallbackResponse(
  callback: CallbackWithRelations,
): CallbackResponseDto {
  return {
    id: callback.id,
    lead_id: callback.leadId,
    scheduled_at: callback.scheduledAt.toISOString(),
    is_completed: callback.isCompleted,
    created_by: {
      id: callback.createdBy.id,
      name: callback.createdBy.fullName,
      role: callback.createdBy.role,
      avatar_url: callback.createdBy.avatarUrl,
    },
    created_at: callback.createdAt.toISOString(),
  };
}

export const CALLBACK_INCLUDE = {
  createdBy: {
    select: { id: true, fullName: true, role: true, avatarUrl: true },
  },
} as const;

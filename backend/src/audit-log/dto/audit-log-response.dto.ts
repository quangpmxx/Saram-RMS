import { Account, AuditLog } from '../../../generated/prisma/client';

/** Đối tượng "AuditLog" — Mục 0.1, docs/13-api-design.md. */
export interface AuditLogResponseDto {
  id: string;
  account: { id: string; name: string };
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

type AuditLogWithAccount = AuditLog & {
  account: Pick<Account, 'id' | 'fullName'>;
};

export const AUDIT_LOG_INCLUDE = {
  account: { select: { id: true, fullName: true } },
} as const;

export function toAuditLogResponse(
  log: AuditLogWithAccount,
): AuditLogResponseDto {
  return {
    id: log.id,
    account: { id: log.account.id, name: log.account.fullName },
    action_type: log.actionType,
    entity_type: log.entityType,
    entity_id: log.entityId,
    field_changed: log.fieldChanged,
    old_value: log.oldValue,
    new_value: log.newValue,
    created_at: log.createdAt.toISOString(),
  };
}

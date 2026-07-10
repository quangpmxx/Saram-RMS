import { Account, SystemConfig } from '../../../generated/prisma/client';

/** Đối tượng "Config" dùng chung — Mục 0.1, docs/13-api-design.md. */
export interface SystemConfigResponseDto {
  key: string;
  value: string;
  description: string | null;
  updated_by: { id: string; name: string };
  updated_at: string;
}

type SystemConfigWithRelations = SystemConfig & {
  updatedBy: Pick<Account, 'id' | 'fullName'>;
};

export function toSystemConfigResponse(
  config: SystemConfigWithRelations,
): SystemConfigResponseDto {
  return {
    key: config.configKey,
    value: config.configValue,
    description: config.description,
    updated_by: { id: config.updatedBy.id, name: config.updatedBy.fullName },
    updated_at: config.updatedAt.toISOString(),
  };
}

export const SYSTEM_CONFIG_INCLUDE = {
  updatedBy: { select: { id: true, fullName: true } },
} as const;

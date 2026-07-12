import { ColumnWidthConfig } from '../../../generated/prisma/client';

export interface ColumnWidthConfigResponseDto {
  table_key: string;
  column_widths: Record<string, number>;
  updated_at: string;
}

export function toColumnWidthResponse(
  config: ColumnWidthConfig,
): ColumnWidthConfigResponseDto {
  return {
    table_key: config.tableKey,
    column_widths: JSON.parse(config.columnWidths) as Record<string, number>,
    updated_at: config.updatedAt.toISOString(),
  };
}

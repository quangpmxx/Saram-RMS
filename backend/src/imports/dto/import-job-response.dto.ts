import { ImportJob } from '../../../generated/prisma/client';

export interface ImportRowError {
  row: number;
  message: string;
}

/** Mục 4, docs/13-api-design.md — GET /candidate/import/:jobId */
export interface ImportJobResponseDto {
  id: string;
  status: string;
  total_rows: number | null;
  success_count: number;
  error_count: number;
  duplicate_count: number;
  errors: ImportRowError[];
  created_at: string;
  updated_at: string;
}

export function toImportJobResponse(job: ImportJob): ImportJobResponseDto {
  return {
    id: job.id,
    status: job.status,
    total_rows: job.totalRows,
    success_count: job.successCount,
    error_count: job.errorCount,
    duplicate_count: job.duplicateCount,
    errors: job.errors ? (JSON.parse(job.errors) as ImportRowError[]) : [],
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
  };
}

import {
  ReportViolationStatus,
  ReportViolationType,
} from '../../../generated/prisma/client';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check phạt" — trang con
 * trong module Báo cáo.
 */
export interface ReportViolationResponseDto {
  id: string;
  account_id: string;
  account_name: string;
  account_avatar_url: string | null;
  team_id: string | null;
  team_name: string | null;
  /** "YYYY-MM-DD" */
  report_date: string;
  /** ISO — snapshot hạn chót TẠI THỜI ĐIỂM phát sinh vi phạm (Mục 9). */
  deadline_snapshot: string;
  actual_submitted_at: string | null;
  violation_type: ReportViolationType;
  status: ReportViolationStatus;
  note: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportDeadlineResponseDto {
  hour: number;
  minute: number;
  updated_at: string | null;
  updated_by_name: string | null;
}

export interface RunReportPenaltyScanResultDto {
  checked: number;
  /** Tên nhân viên bị ghi nhận "Nộp báo cáo muộn" trong lần chạy này. */
  late_submissions: string[];
  /** Tên nhân viên bị ghi nhận "Không nộp báo cáo" trong lần chạy này. */
  no_submissions: string[];
  /** true nếu chưa tới hạn (không quét) — Mục 3, chỉ quét SAU thời hạn. */
  skipped_before_deadline: boolean;
}

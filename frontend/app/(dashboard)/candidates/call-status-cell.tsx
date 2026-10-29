import type { CSSProperties } from "react";
import type { Candidate, Note } from "@/lib/types";
import { noteColorBgHex } from "@/lib/note-colors";
import { CareNoteCell } from "./care-note-cell";

/** Nền ô theo "màu ghi chú" của data — đặt lên chính <td> chứa CallStatusCellContent. */
export function callStatusCellStyle(candidate: Pick<Candidate, "note_color">): CSSProperties {
  return { backgroundColor: noteColorBgHex(candidate.note_color) };
}

/**
 * Nội dung ô "Tình trạng cuộc gọi" (tab Tất cả) = ô "Nội dung ghi chú" (tab
 * Chăm sóc) — dùng chung 1 component để 2 nơi luôn hiện giống hệt nhau
 * (yêu cầu người dùng 2026-10-29): toàn bộ lịch sử ghi chú của data. Không
 * còn dòng nhãn chung đầu ô — nhãn tình trạng/kết quả hiện cạnh tên người xử
 * lý của TỪNG ghi chú (xem care-note-cell.tsx).
 */
export function CallStatusCellContent({ notes }: { notes: Note[] | undefined }) {
  return <CareNoteCell notes={notes} />;
}

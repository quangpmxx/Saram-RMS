import type { CSSProperties } from "react";
import type { Candidate, Note } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { callStatusVariant } from "@/lib/call-status-variant";
import { noteColorBgHex } from "@/lib/note-colors";
import { CareNoteCell } from "./care-note-cell";

export function callResultVariant(name: string): "success" | "warning" | "neutral" {
  if (name.includes("Không tiềm năng")) return "neutral";
  if (name.includes("Tiềm năng")) return "success";
  return "warning";
}

/** Nền ô theo "màu ghi chú" của data — đặt lên chính <td> chứa CallStatusCellContent. */
export function callStatusCellStyle(candidate: Pick<Candidate, "note_color">): CSSProperties {
  return { backgroundColor: noteColorBgHex(candidate.note_color) };
}

/**
 * Nội dung ô "Tình trạng cuộc gọi" (tab Tất cả) = ô "Nội dung ghi chú" (tab
 * Chăm sóc) — dùng chung 1 component để 2 nơi luôn hiện giống hệt nhau
 * (yêu cầu người dùng 2026-10-29): nhãn tình trạng/kết quả cuộc gọi + toàn
 * bộ lịch sử ghi chú của data (ghi chú chăm sóc cũng là ghi chú của data).
 */
export function CallStatusCellContent({
  candidate,
  notes,
}: {
  candidate: Pick<Candidate, "call_status" | "call_result">;
  notes: Note[] | undefined;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {candidate.call_status ? (
          <Badge variant={callStatusVariant(candidate.call_status.name)} className="text-[10px] px-2 py-0">
            {candidate.call_status.name}
          </Badge>
        ) : (
          <Badge variant="neutral" className="text-[10px] px-2 py-0">
            Chưa gọi
          </Badge>
        )}
        {candidate.call_result && (
          <Badge variant={callResultVariant(candidate.call_result.name)} className="text-[10px] px-2 py-0">
            {candidate.call_result.name}
          </Badge>
        )}
      </div>
      <CareNoteCell notes={notes} />
    </>
  );
}

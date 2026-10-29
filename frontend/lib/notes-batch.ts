import { clientApi } from "@/lib/api-client";
import type { Note } from "@/lib/types";

/** Mỗi lần gọi tối đa 100 id — giữ URL ngắn khi trang hiện 200/300 dòng. */
const NOTES_BATCH_CHUNK = 100;

/**
 * GET /candidate/notes?ids=... cho cả trang, tự chia thành nhiều lần gọi khi
 * nhiều data (yêu cầu người dùng 2026-10-29: thêm 200/300 dòng/trang). Lần
 * gọi nào lỗi thì coi như không có ghi chú (như trước).
 */
export async function fetchNotesByLeadIds(
  ids: string[],
  signal?: AbortSignal,
): Promise<Record<string, Note[]>> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += NOTES_BATCH_CHUNK)
    chunks.push(ids.slice(i, i + NOTES_BATCH_CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      clientApi<Record<string, Note[]>>(
        `/candidate/notes?ids=${chunk.join(",")}`,
        { signal },
      ).catch(() => ({}) as Record<string, Note[]>),
    ),
  );
  return Object.assign({}, ...results);
}

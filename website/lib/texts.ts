/** Thẻ cache của chữ sửa tại chỗ — xoá khi lưu (app/lam-moi-noi-dung). */
export const TEXTS_TAG = "website-texts";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

/**
 * Chữ đã sửa trên trang ({ mã: chữ }) lấy từ CRM. Lỗi/mất kết nối → {} (trang dùng chữ gốc),
 * không để trang web sập theo backend.
 */
export async function getTexts(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${API_URL}/website/texts`, {
      next: { tags: [TEXTS_TAG], revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, string>;
  } catch {
    return {};
  }
}

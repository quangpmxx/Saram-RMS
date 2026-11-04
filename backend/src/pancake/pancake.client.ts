/** Gọi API công khai của Pancake (pages.fm) bằng token page. */
const BASE = 'https://pages.fm/api/public_api';
const TIMEOUT_MS = 15_000;

export class PancakeApiError extends Error {
  constructor(
    message: string,
    readonly isTokenInvalid = false,
  ) {
    super(message);
  }
}

export interface PancakeConversation {
  id: string;
  type: string;
  inserted_at: string;
  updated_at: string;
  has_phone?: boolean;
  recent_phone_numbers?: { phone_number?: string }[];
  page_customer?: { name?: string } | null;
  from?: { name?: string } | null;
}

/** Giờ Pancake là UTC nhưng không có hậu tố Z. */
export function parsePancakeTime(s: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

async function call<T>(
  path: string,
  token: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const q = new URLSearchParams({ page_access_token: token });
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${q}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new PancakeApiError('Không kết nối được tới Pancake');
  }
  let body: { success?: boolean; message?: string; error_code?: number };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new PancakeApiError(`Pancake trả lỗi HTTP ${res.status}`);
  }
  if (!res.ok || body.success === false) {
    const invalid =
      res.status === 401 ||
      res.status === 403 ||
      body.error_code === 102 ||
      /access_token/i.test(body.message ?? '');
    throw new PancakeApiError(
      invalid
        ? 'Token Pancake không hợp lệ hoặc đã bị đổi'
        : `Pancake báo lỗi: ${body.message ?? res.status}`,
      invalid,
    );
  }
  return body as T;
}

/** 60 hội thoại cập nhật gần nhất (mới nhất trước); `lastConversationId` để lấy trang kế. */
export async function listRecentConversations(
  pageId: string,
  token: string,
  lastConversationId?: string,
): Promise<PancakeConversation[]> {
  const r = await call<{ conversations?: PancakeConversation[] }>(
    `/v2/pages/${pageId}/conversations`,
    token,
    lastConversationId ? { last_conversation_id: lastConversationId } : {},
  );
  return r.conversations ?? [];
}

/** Hội thoại cập nhật trong khoảng [since, until] (giây Unix), 200/trang, page_number từ 1. */
export async function listConversationsInRange(
  pageId: string,
  token: string,
  since: number,
  until: number,
  pageNumber: number,
): Promise<{ total: number; conversations: PancakeConversation[] }> {
  const r = await call<{
    total?: number;
    conversations?: PancakeConversation[];
  }>(`/v1/pages/${pageId}/conversations`, token, {
    since,
    until,
    page_number: pageNumber,
  });
  return { total: r.total ?? 0, conversations: r.conversations ?? [] };
}

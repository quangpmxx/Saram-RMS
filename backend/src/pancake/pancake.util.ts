import type { PancakeConversation } from './pancake.client';

/**
 * Vòng chia tỉ lệ đan xen: mỗi vòng nhỏ lấy lần lượt các nhóm còn "suất".
 * Vd A=1, B=2 → [A, B, B]; A=2, B=3 → [A, B, A, B, B].
 */
export function buildSequence(
  items: { teamId: string; weight: number }[],
): string[] {
  const active = items.filter((i) => i.weight > 0);
  const max = Math.max(0, ...active.map((i) => i.weight));
  const out: string[] = [];
  for (let round = 0; round < max; round++) {
    for (const i of active) if (i.weight > round) out.push(i.teamId);
  }
  return out;
}

/** Chuẩn hoá SĐT Việt Nam về dạng 0xxxxxxxxx; không hợp lệ → null. */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('84') && d.length >= 11) d = `0${d.slice(2)}`;
  else if (!d.startsWith('0') && d.length === 9) d = `0${d}`;
  return /^0\d{9,10}$/.test(d) ? d : null;
}

/** SĐT đầu tiên hợp lệ Pancake bắt được trong hội thoại. */
export function pickPhone(c: PancakeConversation): string | null {
  for (const p of c.recent_phone_numbers ?? []) {
    const n = normalizePhone(p.phone_number);
    if (n) return n;
  }
  return null;
}

/**
 * Bài + quảng cáo của hội thoại: bình luận → bài được bình luận; inbox qua quảng cáo → quảng cáo
 * khách bấm GẦN NHẤT (và bài của nó). Inbox tự nhiên → không có.
 */
export function pickPost(c: PancakeConversation): {
  postId: string | null;
  adId: string | null;
} {
  const ads = (c.ads ?? []).filter((a) => a?.post_id || a?.ad_id);
  const ad = ads.reduce<(typeof ads)[number] | undefined>(
    (best, a) =>
      !best || (a.inserted_at ?? '') > (best.inserted_at ?? '') ? a : best,
    undefined,
  );
  const postId = (c.post_id || ad?.post_id || '').slice(0, 128) || null;
  const adId = (ad?.ad_id || '').slice(0, 64) || null;
  return { postId, adId };
}

export function customerName(c: PancakeConversation): string {
  const name = (c.page_customer?.name || c.from?.name || '').trim();
  return (name || 'Khách Pancake').slice(0, 150);
}

/** Token page Pancake là JWT có `id` = mã page; chỉ đọc payload, không cần xác minh chữ ký. */
export function pageIdFromToken(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(part, 'base64url').toString('utf8'),
    ) as { id?: unknown };
    const id =
      typeof payload.id === 'string' || typeof payload.id === 'number'
        ? String(payload.id)
        : '';
    return /^\d{5,30}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

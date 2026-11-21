const GRAPH = 'https://graph.facebook.com/v21.0';

export class FacebookApiError extends Error {
  constructor(
    message: string,
    /** Mã lỗi Graph API; 190 = token hết hạn/không hợp lệ. */
    readonly code?: number,
  ) {
    super(message);
  }
  get isTokenInvalid(): boolean {
    return this.code === 190;
  }
}

export interface FbAdAccount {
  externalId: string;
  name: string;
  currency: string;
}
export interface FbDailySpend {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
}

/** Gọi Graph API; token gửi qua header, KHÔNG đưa vào URL/log. Theo phân trang tối đa 20 trang. */
async function getAll<T>(url: string, token: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < 20; i++) {
    const res: Response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: T[];
      paging?: { next?: string };
      error?: { message?: string; code?: number };
    };
    if (!res.ok || body.error) {
      throw new FacebookApiError(
        body.error?.message ?? `Facebook trả lỗi HTTP ${res.status}`,
        body.error?.code,
      );
    }
    out.push(...(body.data ?? []));
    next = body.paging?.next;
  }
  return out;
}

/** Gọi 1 lần (không theo phân trang). */
async function getOne<T>(url: string, token: string): Promise<T> {
  const res: Response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: number };
  };
  if (!res.ok || body.error) {
    throw new FacebookApiError(
      body.error?.message ?? `Facebook trả lỗi HTTP ${res.status}`,
      body.error?.code,
    );
  }
  return body;
}

/** Trạng thái tài khoản (account_status) + có chiến dịch nào đang chạy không. */
export async function fetchAccountHealth(
  token: string,
  externalId: string,
): Promise<{
  accountStatus: number;
  hasActiveCampaign: boolean;
  /** Giới hạn chi tiêu tài khoản; null = không đặt. VNĐ có offset 1 nên số trả về là đồng. */
  spendCap: number | null;
  amountSpent: number | null;
}> {
  const account = await getOne<{
    account_status?: number;
    spend_cap?: string;
    amount_spent?: string;
  }>(
    `${GRAPH}/act_${externalId}?fields=account_status,spend_cap,amount_spent`,
    token,
  );
  const cap = Number(account.spend_cap ?? 0);
  const spent = Number(account.amount_spent);
  const status = encodeURIComponent(JSON.stringify(['ACTIVE']));
  const campaigns = await getOne<{ data?: unknown[] }>(
    `${GRAPH}/act_${externalId}/campaigns?fields=id&effective_status=${status}&limit=1`,
    token,
  );
  return {
    accountStatus: Number(account.account_status ?? 0),
    hasActiveCampaign: (campaigns.data?.length ?? 0) > 0,
    spendCap: cap > 0 ? cap : null,
    amountSpent: Number.isFinite(spent) ? spent : null,
  };
}

/** Các tài khoản quảng cáo mà token này truy cập được. */
export async function listAdAccounts(token: string): Promise<FbAdAccount[]> {
  const rows = await getAll<{
    account_id: string;
    name?: string;
    currency: string;
  }>(`${GRAPH}/me/adaccounts?fields=account_id,name,currency&limit=100`, token);
  return rows.map((r) => ({
    externalId: r.account_id,
    name: r.name || `Tài khoản ${r.account_id}`,
    currency: r.currency,
  }));
}

/** Chi tiêu theo ngày (since/until dạng YYYY-MM-DD, gồm cả 2 đầu). */
export async function fetchDailySpend(
  token: string,
  externalId: string,
  since: string,
  until: string,
): Promise<FbDailySpend[]> {
  const range = encodeURIComponent(JSON.stringify({ since, until }));
  const rows = await getAll<{
    date_start: string;
    spend?: string;
    impressions?: string;
    clicks?: string;
  }>(
    `${GRAPH}/act_${externalId}/insights?fields=spend,impressions,clicks&time_increment=1&time_range=${range}&limit=100`,
    token,
  );
  return rows.map((r) => ({
    date: r.date_start,
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
  }));
}

export interface FbAdCampaign {
  adId: string;
  campaignId: string | null;
  campaignName: string | null;
}

/**
 * Quảng cáo của TKQC kèm camp (để tra mã quảng cáo Pancake ra camp). Lấy cả quảng
 * cáo đã tạm dừng/lưu trữ vì data cũ có thể đến từ camp đã tắt.
 */
export async function fetchAdCampaigns(
  token: string,
  externalId: string,
): Promise<FbAdCampaign[]> {
  const status = encodeURIComponent(
    JSON.stringify([
      'ACTIVE',
      'PAUSED',
      'ARCHIVED',
      'CAMPAIGN_PAUSED',
      'ADSET_PAUSED',
      'IN_PROCESS',
      'WITH_ISSUES',
      'DISAPPROVED',
      'PENDING_REVIEW',
      'PREAPPROVED',
      'PENDING_BILLING_INFO',
    ]),
  );
  const rows = await getAll<{
    id: string;
    campaign?: { id?: string; name?: string };
  }>(
    `${GRAPH}/act_${externalId}/ads?fields=id,campaign{id,name}&effective_status=${status}&limit=200`,
    token,
  );
  return rows.map((r) => ({
    adId: r.id,
    campaignId: r.campaign?.id ?? null,
    campaignName: r.campaign?.name ?? null,
  }));
}

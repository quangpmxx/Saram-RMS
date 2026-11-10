import { createSign } from 'crypto';

/**
 * Đọc Google Sheet bằng tài khoản robot (service account) — chỉ quyền ĐỌC. Tự ký JWT bằng
 * `crypto` có sẵn của Node, không thêm thư viện. Sheet phải được chia sẻ quyền xem cho email robot.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const TIMEOUT_MS = 20_000;

export class GoogleSheetError extends Error {}

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/** Nội dung file chìa khoá .json tải từ Google Cloud → email robot + khoá riêng. Sai dạng → lỗi. */
export function parseServiceAccount(json: string): ServiceAccountKey {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new GoogleSheetError(
      'Chìa khoá không đúng dạng — dán nguyên nội dung file .json tải từ Google Cloud',
    );
  }
  const o = (raw ?? {}) as Record<string, unknown>;
  if (
    typeof o.client_email !== 'string' ||
    typeof o.private_key !== 'string' ||
    !o.private_key.includes('PRIVATE KEY')
  ) {
    throw new GoogleSheetError(
      'Chìa khoá thiếu client_email / private_key — cần file .json của "Service account"',
    );
  }
  return { client_email: o.client_email, private_key: o.private_key };
}

/** Link Google Sheet (hoặc mã sheet) → mã sheet. Không nhận ra → null. */
export function extractSpreadsheetId(input: string): string | null {
  const s = input.trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : null;
}

const b64url = (data: string | Buffer) =>
  Buffer.from(data).toString('base64url');

async function request(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new GoogleSheetError('Không kết nối được tới Google');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // giữ null
  }
  if (res.ok) return body;
  const b = (body ?? {}) as {
    error?: { message?: string } | string;
    error_description?: string;
  };
  const detail =
    (typeof b.error === 'object' ? b.error?.message : b.error_description) ??
    '';
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(detail)) {
    throw new GoogleSheetError(
      'Chưa bật "Google Sheets API" cho dự án Google Cloud của robot',
    );
  }
  if (res.status === 403) {
    throw new GoogleSheetError(
      'Robot chưa được xem sheet — bấm Chia sẻ trên Google Sheet, thêm email robot với quyền Người xem',
    );
  }
  if (res.status === 404) {
    throw new GoogleSheetError(
      'Không tìm thấy Google Sheet — kiểm tra lại link',
    );
  }
  if (url === TOKEN_URL) {
    throw new GoogleSheetError(
      'Google từ chối chìa khoá robot — tạo chìa khoá mới rồi dán lại',
    );
  }
  throw new GoogleSheetError(
    `Google báo lỗi (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
  );
}

export async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 600,
    }),
  )}`;
  let signature: string;
  try {
    signature = createSign('RSA-SHA256')
      .update(unsigned)
      .sign(key.private_key, 'base64url');
  } catch {
    throw new GoogleSheetError('Chìa khoá robot bị hỏng — dán lại file .json');
  }
  const body = (await request(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })) as { access_token?: string };
  if (!body?.access_token) {
    throw new GoogleSheetError('Google không cấp quyền đọc cho robot');
  }
  return body.access_token;
}

/** Tên các tab đang hiện (bỏ tab ẩn), theo thứ tự trên sheet. */
export async function listTabs(
  spreadsheetId: string,
  token: string,
): Promise<string[]> {
  const body = (await request(
    `${API}/${spreadsheetId}?fields=sheets.properties(title,hidden)`,
    { headers: { Authorization: `Bearer ${token}` } },
  )) as { sheets?: { properties?: { title?: string; hidden?: boolean } }[] };
  return (body?.sheets ?? [])
    .filter((s) => s.properties?.title && !s.properties.hidden)
    .map((s) => s.properties!.title!);
}

/** Toàn bộ ô của 1 tab, đúng chữ đang hiển thị trên sheet (ngày "02/11/2026", giờ "7h30"…). */
export async function readTab(
  spreadsheetId: string,
  tab: string,
  token: string,
): Promise<string[][]> {
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'`);
  const body = (await request(
    `${API}/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${token}` } },
  )) as { values?: (string | number | boolean | null)[][] };
  return (body?.values ?? []).map((row) =>
    row.map((v) => (v === null || v === undefined ? '' : String(v))),
  );
}

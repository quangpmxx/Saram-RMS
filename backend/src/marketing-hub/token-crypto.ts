import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/** Mã hoá token quảng cáo bằng AES-256-GCM; khoá = SHA-256 của MARKETING_TOKEN_KEY (≥ 32 ký tự). */
function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString('base64'))
    .join('.');
}

export function decryptToken(payload: string, secret: string): string {
  const [iv, tag, data] = payload
    .split('.')
    .map((s) => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}

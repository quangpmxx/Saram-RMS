import { AccountRole } from '../../../generated/prisma/enums';

/** Payload lưu trong JWT — Mục 8, docs/09: xác thực bằng token phiên đăng nhập. */
export interface JwtPayload {
  sub: string; // account id
  role: AccountRole;
  sessionId: string;
}

/** Thông tin gắn vào request sau khi JwtStrategy xác thực thành công. */
export interface AuthenticatedUser {
  id: string;
  role: AccountRole;
  sessionId: string;
}

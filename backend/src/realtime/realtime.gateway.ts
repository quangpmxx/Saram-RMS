import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth-cookie.util';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../common/interfaces/jwt-payload.interface';
import {
  LeadEventTargets,
  LeadRealtimeEvent,
} from './realtime-event.interface';
import { AppEventTargets, AppRealtimeEvent } from './app-event.interface';

const LEAD_EVENT_NAME = 'leads:update';
/** Kênh riêng cho 4 module mới (Đưa đón/Báo cáo/Check phạt/Thông báo/Dashboard) — xem app-event.interface.ts. */
const APP_EVENT_NAME = 'app:event';

/** Khớp đúng field cần cho AuthenticatedUser trên socket đã xác thực. */
interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthenticatedUser;
  };
}

/**
 * Tự phân giải header `Cookie` thay vì phụ thuộc gói `cookie` ngoài — gói
 * đó chỉ phát hành bản ESM thuần (`export function ...`), Jest (CommonJS)
 * không transform được node_modules mặc định, gây lỗi biên dịch test. Chỉ
 * cần đúng 1 việc đơn giản (tách "name=value" theo "; ", decode value) nên
 * tự viết an toàn hơn là chỉnh cấu hình Jest toàn cục cho 1 gói phụ.
 */
function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const rawValue = pair.slice(separatorIndex + 1).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(rawValue);
    } catch {
      result[name] = rawValue;
    }
  }
  return result;
}

function userRoom(accountId: string): string {
  return `user:${accountId}`;
}
function teamRoom(teamId: string): string {
  return `team:${teamId}`;
}
/**
 * KHÁC với teamRoom() — teamRoom() có CẢ Leader lẫn mọi Sale trong nhóm
 * (đúng cho Data lao động, nơi Sale cùng nhóm được xem lead của nhau). Báo
 * cáo hằng ngày/Check phạt thì Sale CHỈ được xem của chính mình, chỉ Leader
 * mới được xem cả nhóm — cần phòng riêng, không lẫn với teamRoom() kẻo lộ
 * báo cáo/vi phạm của 1 Sale cho các Sale khác cùng nhóm.
 */
function leaderRoom(teamId: string): string {
  return `leader:${teamId}`;
}
const FULL_ACCESS_ROOM = 'role:full-access';
/**
 * Mục 2, yêu cầu người dùng: Leader/Sale còn xem được lead THẬT SỰ chưa có
 * nhóm (assignedTeamId=null, vd Excel cũ chưa gán nhóm — xem buildScopeWhere
 * ở candidates.service.ts). Không có "phòng nhóm" nào phù hợp cho trường hợp
 * này nên dùng 1 phòng chung cho MỌI Leader/Sale đang kết nối.
 */
const LEADER_SALE_GENERAL_ROOM = 'role:leader-sale-general';
/**
 * Mục 6, yêu cầu người dùng (mở rộng 4 module) — dùng cho Đưa đón: module
 * này KHÔNG có giới hạn RBAC theo bản ghi (xác nhận qua code thật, xem
 * app-event.interface.ts) — mọi tài khoản đã đăng nhập đều vào phòng này.
 */
const ALL_AUTHENTICATED_ROOM = 'role:all';
/**
 * Dùng cho Báo cáo hằng ngày/Check phạt — 2 module này loại MKT khỏi phạm
 * vi xem (khác Data lao động, nơi MKT vẫn xem được qua FULL_ACCESS_ROOM) —
 * cần phòng riêng chỉ Admin/Quản lý, không tái dùng FULL_ACCESS_ROOM.
 */
const ADMIN_MANAGER_ROOM = 'role:admin-manager';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16) — "Sửa chức năng cập nhật dữ
 * liệu realtime trong module Data lao động": WebSocket gateway (Socket.IO)
 * phát sự kiện thay đổi Lead/Note tới ĐÚNG những tài khoản có quyền xem,
 * dùng cơ chế "phòng" (room) của Socket.IO thay vì kiểm tra quyền theo
 * từng kết nối trên từng sự kiện (tốn kém, phải truy vấn DB mỗi lần phát).
 *
 * Xác thực khi bắt tay (handshake) — LẶP LẠI logic của JwtStrategy.validate()
 * (xem jwt.strategy.ts) vì Nest không tự chạy Guard HTTP (JwtAuthGuard) cho
 * WebSocket gateway; phải tự đọc cookie `access_token` từ header bắt tay
 * (trình duyệt gửi kèm cookie khi cùng site, giống mọi request HTTP khác).
 *
 * Phòng được gia nhập lúc kết nối, tính 1 LẦN theo dữ liệu tài khoản TẠI
 * THỜI ĐIỂM kết nối — đổi nhóm/vai trò sau khi đã kết nối cần kết nối lại
 * (chấp nhận được — hiếm khi xảy ra giữa phiên làm việc, và mất kết nối/tải
 * lại trang tự động kết nối lại với dữ liệu mới nhất).
 */
// CORS: dùng "origin: true" (phản chiếu đúng Origin của request) thay vì
// đọc CORS_ORIGIN qua ConfigService — decorator này chạy lúc IMPORT module
// (trước khi ConfigModule.forRoot() nạp .env ở runtime), nên đọc biến môi
// trường ở đây không đáng tin cậy. An toàn thực sự nằm ở xác thực cookie
// (httpOnly + sameSite=lax, xem authenticate() bên dưới) — 1 origin lạ
// không thể tự có cookie access_token hợp lệ của người dùng, không phải ở
// lớp CORS (đúng khớp cách nhiều triển khai Socket.IO thực tế xử lý, CORS
// chỉ là quy ước phía trình duyệt, không phải hàng rào bảo mật chính khi
// cookie đã httpOnly+sameSite).
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.authenticate(client);
      (client as AuthenticatedSocket).data.user = user;

      const rooms = [userRoom(user.id), ALL_AUTHENTICATED_ROOM];
      if (
        user.role === 'admin' ||
        user.role === 'manager' ||
        user.role === 'mkt'
      ) {
        rooms.push(FULL_ACCESS_ROOM);
      }
      if (user.role === 'admin' || user.role === 'manager') {
        rooms.push(ADMIN_MANAGER_ROOM);
      }
      if (user.role === 'leader' || user.role === 'sale') {
        rooms.push(LEADER_SALE_GENERAL_ROOM);
        const account = await this.prisma.account.findUnique({
          where: { id: user.id },
        });
        if (account?.teamId) {
          rooms.push(teamRoom(account.teamId));
          if (user.role === 'leader') {
            rooms.push(leaderRoom(account.teamId));
          }
        }
      }
      await client.join(rooms);
    } catch (error) {
      this.logger.warn(
        `Từ chối kết nối WebSocket không xác thực được: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Socket.IO tự rời khỏi mọi phòng khi ngắt kết nối — không cần dọn tay.
  }

  /** Khớp cookieExtractor() ở jwt.strategy.ts, nhưng đọc từ header bắt tay WebSocket thay vì Express Request. */
  private async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const cookieHeader = client.handshake.headers.cookie;
    const token = cookieHeader
      ? (parseCookieHeader(cookieHeader)[ACCESS_TOKEN_COOKIE] ?? null)
      : null;
    if (!token) {
      throw new Error('Thiếu cookie đăng nhập');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
    });

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });
    if (!session || session.revokedAt) {
      throw new Error('Phiên đăng nhập đã kết thúc');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });
    if (!account || account.status === 'inactive') {
      throw new Error('Tài khoản không còn hoạt động');
    }

    return { id: account.id, role: account.role, sessionId: session.id };
  }

  /**
   * Tính danh sách phòng cần phát dựa trên `targets` (không tự truy vấn DB
   * — nơi gọi đã có sẵn dữ liệu này từ chính thao tác vừa ghi DB thành
   * công). Emit duy nhất 1 sự kiện `leads:update` — Socket.IO tự loại
   * trùng nếu 1 socket đang ở nhiều phòng đích cùng lúc (vd vừa là người
   * phụ trách vừa cùng nhóm), không phát trùng 2 lần cho cùng 1 client.
   */
  broadcastLeadEvent(
    targets: LeadEventTargets,
    payload: LeadRealtimeEvent,
  ): void {
    const rooms: string[] = [FULL_ACCESS_ROOM];
    if (targets.assignedTeamId) {
      rooms.push(teamRoom(targets.assignedTeamId));
    } else if (targets.visibleToAllLeaderSale) {
      rooms.push(LEADER_SALE_GENERAL_ROOM);
    }
    if (targets.assignedToId) {
      rooms.push(userRoom(targets.assignedToId));
    }
    if (targets.carePoolLockedById) {
      rooms.push(userRoom(targets.carePoolLockedById));
    }

    this.server.to(rooms).emit(LEAD_EVENT_NAME, payload);
  }

  /**
   * Mục 5, yêu cầu người dùng (mở rộng realtime sang Đưa đón/Báo cáo/Check
   * phạt/Thông báo/Dashboard) — hàm phát TỔNG QUÁT, tách biệt hoàn toàn khỏi
   * `broadcastLeadEvent()` ở trên (không đụng logic Data lao động đang chạy
   * ổn định). Dùng CHUNG 1 kênh `app:event` cho cả 4 module mới — client
   * lọc theo field `module` trong payload thay vì mở nhiều kênh Socket.IO
   * khác nhau, vẫn cùng 1 connection/gateway DUY NHẤT.
   */
  broadcastAppEvent(targets: AppEventTargets, payload: AppRealtimeEvent): void {
    const rooms: string[] = [];
    if (targets.broadcastAll) {
      rooms.push(ALL_AUTHENTICATED_ROOM);
    }
    if (targets.adminManagerOnly) {
      rooms.push(ADMIN_MANAGER_ROOM);
    }
    if (targets.leaderOfTeamId) {
      rooms.push(leaderRoom(targets.leaderOfTeamId));
    }
    if (targets.accountId) {
      rooms.push(userRoom(targets.accountId));
    }

    if (rooms.length === 0) {
      this.logger.warn(
        `broadcastAppEvent: không có phòng đích nào cho sự kiện ${payload.module}.${payload.action} — bỏ qua phát (kiểm tra lại targets truyền vào).`,
      );
      return;
    }

    this.server.to(rooms).emit(APP_EVENT_NAME, payload);
  }
}

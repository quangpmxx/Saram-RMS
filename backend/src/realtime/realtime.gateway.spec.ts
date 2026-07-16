import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { LeadRealtimeEvent } from './realtime-event.interface';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: { verifyAsync: jest.Mock };
  let prisma: {
    session: { findUnique: jest.Mock };
    account: { findUnique: jest.Mock };
  };
  let emit: jest.Mock;
  let to: jest.Mock;

  const session = { id: 'session-1', revokedAt: null };
  const saleAccount = {
    id: 'sale-1',
    role: 'sale',
    status: 'active',
    teamId: 'team-1',
  };

  /**
   * KHÔNG ép kiểu (as Socket) ở đây — nếu gán thẳng type Socket, ESLint
   * (@typescript-eslint/unbound-method) sẽ hiểu socket.join/disconnect là
   * PHƯƠNG THỨC của interface Socket (có this-binding thật), và báo lỗi ở
   * mọi chỗ expect(socket.join)/expect(socket.disconnect) bên dưới — dù
   * đây chỉ là jest.fn() thuần. Giữ nguyên object literal (kiểu suy luận
   * tự nhiên), chỉ ép kiểu tại ĐIỂM GỌI gateway.handleConnection(), không
   * ép kiểu cho biến socket.
   */
  function mockSocket(cookie: string | undefined) {
    return {
      handshake: { headers: { cookie } },
      data: {},
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };
  }

  function asSocket(socket: ReturnType<typeof mockSocket>) {
    return socket as unknown as import('socket.io').Socket;
  }

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    prisma = {
      session: { findUnique: jest.fn() },
      account: { findUnique: jest.fn() },
    };
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });

    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('secret') },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gateway = moduleRef.get(RealtimeGateway);
    // @ts-expect-error — gán trực tiếp Server giả lập (private field, chỉ dùng trong test).
    gateway['server'] = { to };
  });

  describe('handleConnection — xác thực + gia nhập phòng', () => {
    it('ngắt kết nối nếu thiếu cookie đăng nhập', async () => {
      const socket = mockSocket(undefined);
      await gateway.handleConnection(asSocket(socket));
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('ngắt kết nối nếu JWT không hợp lệ/hết hạn', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));
      const socket = mockSocket('access_token=bad-token');
      await gateway.handleConnection(asSocket(socket));
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('ngắt kết nối nếu phiên đăng nhập đã bị thu hồi', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'sale-1',
        role: 'sale',
        sessionId: 'session-1',
      });
      prisma.session.findUnique.mockResolvedValue({
        ...session,
        revokedAt: new Date(),
      });
      const socket = mockSocket('access_token=tok');
      await gateway.handleConnection(asSocket(socket));
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('Sale xác thực thành công -> gia nhập phòng user + team + leader-sale-general (KHÔNG có full-access)', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'sale-1',
        role: 'sale',
        sessionId: 'session-1',
      });
      prisma.session.findUnique.mockResolvedValue(session);
      prisma.account.findUnique.mockResolvedValue(saleAccount);

      const socket = mockSocket('access_token=good-token; other=x');
      await gateway.handleConnection(asSocket(socket));

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.join).toHaveBeenCalledWith([
        'user:sale-1',
        'role:all',
        'role:leader-sale-general',
        'team:team-1',
      ]);
    });

    it('Admin xác thực thành công -> gia nhập phòng user + full-access (KHÔNG có team/leader-sale-general)', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'admin-1',
        role: 'admin',
        sessionId: 'session-1',
      });
      prisma.session.findUnique.mockResolvedValue(session);
      prisma.account.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
        status: 'active',
        teamId: null,
      });

      const socket = mockSocket('access_token=good-token');
      await gateway.handleConnection(asSocket(socket));

      expect(socket.join).toHaveBeenCalledWith([
        'user:admin-1',
        'role:all',
        'role:full-access',
        'role:admin-manager',
      ]);
      // authenticate() luôn tra account 1 lần để xác thực còn hoạt động —
      // nhưng KHÔNG tra lần 2 để lấy teamId (chỉ Leader/Sale cần).
      expect(prisma.account.findUnique).toHaveBeenCalledTimes(1);
    });

    it('Sale không có teamId (chưa vào nhóm nào) -> KHÔNG gia nhập phòng team', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'sale-2',
        role: 'sale',
        sessionId: 'session-1',
      });
      prisma.session.findUnique.mockResolvedValue(session);
      prisma.account.findUnique.mockResolvedValue({
        ...saleAccount,
        id: 'sale-2',
        teamId: null,
      });

      const socket = mockSocket('access_token=good-token');
      await gateway.handleConnection(asSocket(socket));

      expect(socket.join).toHaveBeenCalledWith([
        'user:sale-2',
        'role:all',
        'role:leader-sale-general',
      ]);
    });

    it('Leader xác thực thành công -> gia nhập thêm phòng leader riêng (leader:<teamId>), KHÁC phòng team chung', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'leader-1',
        role: 'leader',
        sessionId: 'session-1',
      });
      prisma.session.findUnique.mockResolvedValue(session);
      prisma.account.findUnique.mockResolvedValue({
        id: 'leader-1',
        role: 'leader',
        status: 'active',
        teamId: 'team-1',
      });

      const socket = mockSocket('access_token=good-token');
      await gateway.handleConnection(asSocket(socket));

      expect(socket.join).toHaveBeenCalledWith([
        'user:leader-1',
        'role:all',
        'role:leader-sale-general',
        'team:team-1',
        'leader:team-1',
      ]);
    });
  });

  describe('broadcastLeadEvent — định tuyến phòng', () => {
    const basePayload: LeadRealtimeEvent = {
      lead_id: 'lead-1',
      change_type: 'updated',
      updated_at: '2026-07-16T00:00:00.000Z',
      actor: { id: 'admin-1', role: 'admin' },
    };

    it('lead có nhóm -> phát tới full-access + team + assigned_to + care_pool_locked_by', () => {
      gateway.broadcastLeadEvent(
        {
          assignedTeamId: 'team-1',
          assignedToId: 'sale-1',
          carePoolLockedById: 'sale-2',
        },
        basePayload,
      );

      expect(to).toHaveBeenCalledWith([
        'role:full-access',
        'team:team-1',
        'user:sale-1',
        'user:sale-2',
      ]);
      expect(emit).toHaveBeenCalledWith('leads:update', basePayload);
    });

    it('lead CHƯA có nhóm (assignedTeamId=null) -> phát tới full-access + leader-sale-general (KHÔNG có phòng team nào)', () => {
      gateway.broadcastLeadEvent(
        { assignedTeamId: null, visibleToAllLeaderSale: true },
        basePayload,
      );

      expect(to).toHaveBeenCalledWith([
        'role:full-access',
        'role:leader-sale-general',
      ]);
    });

    it('lead có nhóm nhưng chưa gán người/chưa ai khóa chăm sóc -> chỉ full-access + team', () => {
      gateway.broadcastLeadEvent({ assignedTeamId: 'team-1' }, basePayload);

      expect(to).toHaveBeenCalledWith(['role:full-access', 'team:team-1']);
    });
  });

  describe('broadcastAppEvent — định tuyến phòng (Đưa đón/Báo cáo/Check phạt/Thông báo/Dashboard)', () => {
    const appPayload = {
      module: 'transportation' as const,
      entity: 'transportation',
      action: 'created' as const,
      entity_id: 'ship-1',
      updated_at: '2026-07-16T00:00:00.000Z',
      actor: { id: 'sale-1', role: 'sale' as const },
    };

    it('broadcastAll (Đưa đón) -> chỉ phòng role:all', () => {
      gateway.broadcastAppEvent({ broadcastAll: true }, appPayload);

      expect(to).toHaveBeenCalledWith(['role:all']);
      expect(emit).toHaveBeenCalledWith('app:event', appPayload);
    });

    it('Báo cáo/Check phạt (accountId + leaderOfTeamId + adminManagerOnly) -> 3 phòng riêng biệt, KHÔNG có phòng team chung (tránh lộ cho Sale cùng nhóm)', () => {
      gateway.broadcastAppEvent(
        {
          accountId: 'sale-1',
          leaderOfTeamId: 'team-1',
          adminManagerOnly: true,
        },
        appPayload,
      );

      expect(to).toHaveBeenCalledWith([
        'role:admin-manager',
        'leader:team-1',
        'user:sale-1',
      ]);
    });

    it('Thông báo (chỉ accountId) -> chỉ đúng 1 người nhận', () => {
      gateway.broadcastAppEvent({ accountId: 'sale-1' }, appPayload);

      expect(to).toHaveBeenCalledWith(['user:sale-1']);
    });

    it('Không có target nào -> KHÔNG gọi server.to/emit (an toàn, không phát nhầm)', () => {
      gateway.broadcastAppEvent({}, appPayload);

      expect(to).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });
  });
});

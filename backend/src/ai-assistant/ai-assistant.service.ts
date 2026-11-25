import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { CareWarehouseService } from '../care-warehouse/care-warehouse.service';
import { MarketingHubService } from '../marketing-hub/marketing-hub.service';
import { ModulePermissionService } from '../module-permission/module-permission.service';
import { can } from '../common/permissions/capability-catalog';
import { findOwnTeamId } from '../common/utils/account-team.util';
import { NO_MATCH_UUID } from '../common/utils/no-match-uuid';
import { vnDayRange } from '../care-warehouse/care-time.util';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { decryptToken, encryptToken } from '../marketing-hub/token-crypto';
import {
  SHUTTLE_RESULT_FAILED,
  SHUTTLE_RESULT_PASSED,
  SHUTTLE_STATUS_ATTENDED,
  SHUTTLE_STATUS_NO_SHOW,
} from '../shuttle/dto/create-shuttle-option.dto';
import {
  GeminiContent,
  GeminiError,
  GeminiFunctionDeclaration,
  geminiGenerate,
  geminiListModels,
} from './gemini.client';
import {
  AskAiDto,
  SaveAiConfigDto,
  SaveAiKnowledgeDto,
} from './ai-assistant.dto';
import { APP_GUIDE } from './app-guide';

/** Flash-Lite: gói miễn phí ~500 lượt/ngày (Flash chỉ ~20) — 2026-11. */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';
const MAX_TOOL_ROUNDS = 5;
/**
 * Google hay báo 503 "high demand" lúc đông (2026-11-25): thử lại 2 lần rồi chuyển mô hình dự phòng.
 * Thứ tự dự phòng: rẻ/nhiều lượt trước.
 */
const FALLBACK_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Quản lý',
  leader: 'Leader',
  sup_leader: 'Sup Leader',
  sale: 'Sale',
  mkt: 'MKT',
  shuttle_staff: 'Nhân viên đưa đón',
  accounting: 'Kế toán',
  order_staff: 'Nhân viên đơn hàng',
  media_staff: 'Nhân viên Media',
  recruitment_staff: 'Nhân viên tuyển dụng',
};

export const DEFAULT_ASSISTANT_NAME = 'Trợ lý Đại Việt';

/** Khoảng ngày chung cho các công cụ. */
const RANGE_PARAMS = {
  type: 'OBJECT',
  properties: {
    from: { type: 'STRING', description: 'Ngày bắt đầu YYYY-MM-DD' },
    to: {
      type: 'STRING',
      description: 'Ngày kết thúc YYYY-MM-DD (tính cả ngày này)',
    },
  },
  required: ['from', 'to'],
};

const TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: 'dashboard_kpi',
    description:
      'Số liệu Dashboard trong khoảng ngày: data mới, hẹn/đến/bùng/đỗ/trượt phỏng vấn, các tỷ lệ, chia CT/TV; ' +
      'kèm theo từng nhóm và từng nhân viên (trong phạm vi người hỏi được xem). ' +
      'by_person = true khi hỏi theo cả tháng (đếm mỗi người 1 lần), false khi hỏi theo ngày/tuần (đếm từng lượt).',
    parameters: {
      ...RANGE_PARAMS,
      properties: {
        ...RANGE_PARAMS.properties,
        by_person: {
          type: 'BOOLEAN',
          description: 'Đếm theo người (true) hay theo lượt (false)',
        },
      },
    },
  },
  {
    name: 'top_ranking',
    description:
      'Top 3 nhân viên hẹn phỏng vấn / đỗ phỏng vấn nhiều nhất toàn công ty trong khoảng ngày.',
    parameters: RANGE_PARAMS,
  },
  {
    name: 'shuttle_stats',
    description:
      'Thống kê Danh sách đưa đón (lịch hẹn phỏng vấn) trong khoảng ngày: tổng số lượt, theo tình trạng, ' +
      'đỗ/trượt, theo ngày, theo công ty (đơn hàng), theo Sale, theo người đưa đón, theo khu vực, loại hình, nguồn.',
    parameters: RANGE_PARAMS,
  },
  {
    name: 'marketing_cost',
    description:
      'Chi phí quảng cáo trong khoảng ngày: tổng tiền tiêu, số data, chi phí mỗi data, chi phí mỗi lượt hẹn phỏng vấn.',
    parameters: RANGE_PARAMS,
  },
  {
    name: 'ad_accounts',
    description:
      'Danh sách tài khoản quảng cáo (TKQC): người phụ trách, tiền đã tiêu trong khoảng ngày, số dư còn lại, ' +
      'tình trạng tài khoản, có chiến dịch đang chạy không; kèm số data theo nhân viên MKT.',
    parameters: RANGE_PARAMS,
  },
  {
    name: 'lead_colors',
    description:
      'Đếm data (lao động) theo màu bôi ghi chú: đỏ / vàng / xanh / chưa bôi, theo người đang giữ số. ' +
      'Tính trên data up trong khoảng ngày (theo ngày up). "Số bôi đỏ", "số đỏ" = red.',
    parameters: RANGE_PARAMS,
  },
  {
    name: 'care_progress',
    description:
      'Tiến độ chăm sóc Kho data trong tháng: đã chăm sóc / cần chăm sóc / chưa chăm sóc, theo nhóm và nhân viên.',
    parameters: {
      type: 'OBJECT',
      properties: { month: { type: 'STRING', description: 'Tháng YYYY-MM' } },
      required: ['month'],
    },
  },
];

/** Bỏ id / ảnh đại diện khỏi kết quả gửi cho AI — chỉ giữ tên và số. */
function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'id' || k.endsWith('_id') || k.includes('avatar')) continue;
      out[k] = strip(v);
    }
    return out;
  }
  return value;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function vnNow(): Date {
  return new Date(Date.now() + 7 * 3600_000);
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly dashboard: DashboardService,
    private readonly care: CareWarehouseService,
    private readonly marketing: MarketingHubService,
    private readonly modules: ModulePermissionService,
  ) {}

  private tokenKey(): string {
    const key = this.config.get<string>('MARKETING_TOKEN_KEY');
    if (!key || key.length < 32) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình MARKETING_TOKEN_KEY (≥ 32 ký tự) trên máy chủ',
      );
    }
    return key;
  }

  // ---------------------------------------------------------------- Cài đặt (Admin)

  async getConfig() {
    const cfg = await this.prisma.aiAssistantConfig.findFirst();
    if (!cfg) {
      return {
        connected: false,
        model: DEFAULT_GEMINI_MODEL,
        assistant_name: DEFAULT_ASSISTANT_NAME,
        persona: '',
        knowledge: '',
        allow_chitchat: false,
      };
    }
    const by = await this.prisma.account.findUnique({
      where: { id: cfg.updatedById },
      select: { fullName: true },
    });
    return {
      connected: Boolean(cfg.encryptedKey),
      model: cfg.model,
      key_hint: cfg.keyHint,
      assistant_name: cfg.assistantName,
      persona: cfg.persona ?? '',
      knowledge: cfg.knowledge ?? '',
      allow_chitchat: cfg.allowChitchat,
      updated_at: cfg.updatedAt.toISOString(),
      updated_by_name: by?.fullName ?? null,
    };
  }

  async saveConfig(dto: SaveAiConfigDto, user: AuthenticatedUser) {
    const model = dto.model?.trim() || DEFAULT_GEMINI_MODEL;
    const existing = await this.prisma.aiAssistantConfig.findFirst();
    let apiKey = dto.api_key?.trim();
    if (!apiKey) {
      if (!existing?.encryptedKey)
        throw new BadRequestException('Hãy nhập khoá API Gemini');
      apiKey = decryptToken(existing.encryptedKey, this.tokenKey());
    }
    // Thử gọi 1 câu ngắn — khoá / tên mô hình sai thì báo ngay, không lưu.
    try {
      await geminiGenerate(apiKey, model, {
        contents: [
          { role: 'user', parts: [{ text: 'Trả lời đúng 1 chữ: OK' }] },
        ],
      });
    } catch (e) {
      throw new BadRequestException(
        `Gemini chưa nhận khoá / mô hình này: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const data = {
      model,
      encryptedKey: encryptToken(apiKey, this.tokenKey()),
      keyHint: apiKey.slice(-4),
      updatedById: user.id,
    };
    if (existing) {
      await this.prisma.aiAssistantConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.aiAssistantConfig.create({ data });
    }
    await this.audit.log({
      accountId: user.id,
      actionType: existing ? 'update' : 'create',
      entityType: 'ai_assistant_config',
      fieldChanged: 'model',
      oldValue: existing?.model,
      newValue: model,
    });
    return this.getConfig();
  }

  /** Tên trợ lý + "trợ lý là ai" + sổ tay công ty — lưu được cả khi chưa có khoá. */
  async saveKnowledge(dto: SaveAiKnowledgeDto, user: AuthenticatedUser) {
    const data = {
      assistantName: dto.assistant_name?.trim() || DEFAULT_ASSISTANT_NAME,
      persona: dto.persona?.trim() || null,
      knowledge: dto.knowledge?.trim() || null,
      allowChitchat: dto.allow_chitchat === true,
      updatedById: user.id,
    };
    const existing = await this.prisma.aiAssistantConfig.findFirst();
    if (existing) {
      await this.prisma.aiAssistantConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.aiAssistantConfig.create({
        data: { ...data, model: DEFAULT_GEMINI_MODEL },
      });
    }
    await this.audit.log({
      accountId: user.id,
      actionType: 'update',
      entityType: 'ai_assistant_config',
      fieldChanged: 'knowledge',
    });
    return this.getConfig();
  }

  /** Mô hình chọn được: theo khoá vừa nhập, hoặc khoá đang lưu. */
  async listModels(apiKey?: string) {
    let key = apiKey?.trim();
    if (!key) {
      const cfg = await this.prisma.aiAssistantConfig.findFirst();
      if (!cfg?.encryptedKey)
        throw new BadRequestException('Hãy nhập khoá API Gemini trước');
      key = decryptToken(cfg.encryptedKey, this.tokenKey());
    }
    try {
      return await geminiListModels(key);
    } catch (e) {
      throw new BadRequestException(
        `Không lấy được danh sách mô hình: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Gỡ khoá — giữ lại tên trợ lý + sổ tay công ty. */
  async removeConfig(user: AuthenticatedUser) {
    await this.prisma.aiAssistantConfig.updateMany({
      data: { encryptedKey: null, keyHint: null, updatedById: user.id },
    });
    await this.audit.log({
      accountId: user.id,
      actionType: 'delete',
      entityType: 'ai_assistant_config',
      fieldChanged: 'api_key',
    });
    return this.getConfig();
  }

  async status() {
    const cfg = await this.prisma.aiAssistantConfig.findFirst({
      select: { encryptedKey: true, assistantName: true },
    });
    return {
      ai_enabled: Boolean(cfg?.encryptedKey),
      assistant_name: cfg?.assistantName ?? DEFAULT_ASSISTANT_NAME,
    };
  }

  // ---------------------------------------------------------------- Hỏi đáp

  async ask(
    dto: AskAiDto,
    user: AuthenticatedUser,
  ): Promise<{ answer: string }> {
    const cfg = await this.prisma.aiAssistantConfig.findFirst();
    if (!cfg?.encryptedKey)
      throw new ServiceUnavailableException('Admin chưa liên kết AI Gemini');
    const apiKey = decryptToken(cfg.encryptedKey, this.tokenKey());
    const me = await this.prisma.account.findUnique({
      where: { id: user.id },
      select: { fullName: true },
    });

    const contents: GeminiContent[] = [
      ...(dto.history ?? []).slice(-8).map((h) => ({
        role: h.role,
        parts: [{ text: h.text.slice(0, 2000) }],
      })),
      { role: 'user', parts: [{ text: dto.question.slice(0, 1000) }] },
    ];
    const system = this.systemPrompt(
      me?.fullName ?? '',
      user.role,
      cfg,
      await this.companyDirectory(),
    );

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const reply = await this.generateWithRetry(apiKey, cfg.model, {
          systemInstruction: system,
          contents,
          tools: round < MAX_TOOL_ROUNDS ? TOOLS : undefined,
        });
        const calls = reply.parts.filter((p) => p.functionCall);
        if (!calls.length) {
          const text = reply.parts
            .map((p) => p.text ?? '')
            .join('')
            .trim();
          return { answer: text || 'Xin lỗi, mình chưa trả lời được câu này.' };
        }
        contents.push(reply);
        const responses = await Promise.all(
          calls.map(async (p) => {
            const { name, args } = p.functionCall!;
            const result = await this.runTool(name, args ?? {}, user).catch(
              (e: unknown) => ({
                error:
                  e instanceof Error ? e.message : 'Không lấy được số liệu',
              }),
            );
            return {
              functionResponse: { name, response: { result: strip(result) } },
            };
          }),
        );
        contents.push({ role: 'user', parts: responses });
      }
    } catch (e) {
      if (e instanceof GeminiError) {
        this.logger.warn(`Gemini ${e.status}: ${e.message}`);
        // Hết lượt (mọi mô hình dự phòng cũng hết) → 429: khung chat khoá ô hỏi, không báo gì.
        if (e.status === 429) {
          throw new HttpException('AI hết lượt', HttpStatus.TOO_MANY_REQUESTS);
        }
        throw new ServiceUnavailableException(
          'AI đang bận, bạn thử lại sau nhé.',
        );
      }
      throw e;
    }
    return {
      answer:
        'Xin lỗi, câu này cần tra quá nhiều số liệu, bạn hỏi ngắn hơn nhé.',
    };
  }

  /** 503/500 (Google quá tải): thử lại 2 lần, rồi lần lượt các mô hình dự phòng. 429 (hết lượt) cũng thử mô hình khác. */
  private async generateWithRetry(
    apiKey: string,
    model: string,
    body: Parameters<typeof geminiGenerate>[2],
  ) {
    const models = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
    let last: unknown;
    for (const m of models) {
      for (let attempt = 0; attempt < (m === model ? 3 : 1); attempt++) {
        try {
          return await geminiGenerate(apiKey, m, body);
        } catch (e) {
          last = e;
          if (!(e instanceof GeminiError)) throw e;
          const busy = e.status === 503 || e.status === 500;
          if (e.status === 429 || e.status === 404) break; // sang mô hình khác
          if (!busy) throw e;
          this.logger.warn(`Gemini ${m} ${e.status}, thử lại`);
          await sleep(800 * (attempt + 1));
        }
      }
    }
    throw last;
  }

  /**
   * Danh bạ nội bộ tự lấy từ trang Tài khoản: nhóm + Leader, nhân viên (tên, biệt danh, vai trò,
   * chức vụ, nhóm, văn phòng). KHÔNG gửi SĐT, CCCD, ngân hàng, ngày sinh.
   */
  private async companyDirectory(): Promise<string> {
    const [teams, people] = await Promise.all([
      this.prisma.team.findMany({
        select: { name: true, leader: { select: { fullName: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.account.findMany({
        where: { deletedAt: null, status: 'active' },
        select: {
          fullName: true,
          nickname: true,
          role: true,
          position: true,
          office: true,
          team: { select: { name: true } },
        },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      }),
    ]);
    const teamLines = teams.map(
      (t) => `- Nhóm ${t.name}: Leader ${t.leader?.fullName ?? '(chưa đặt)'}`,
    );
    const peopleLines = people.map((a) =>
      [
        `- ${a.fullName}`,
        a.nickname ? `(gọi là ${a.nickname})` : '',
        `— ${a.position || ROLE_LABEL[a.role] || a.role}`,
        a.team ? `, nhóm ${a.team.name}` : '',
        a.office === 'hcm' ? ', văn phòng HCM' : '',
      ].join(' '),
    );
    return [
      'Các nhóm:',
      ...teamLines,
      '',
      `Nhân sự đang làm việc (${people.length} người):`,
      ...peopleLines,
    ]
      .join('\n')
      .slice(0, 12_000);
  }

  private systemPrompt(
    name: string,
    role: string,
    cfg: {
      assistantName: string;
      persona: string | null;
      knowledge: string | null;
      allowChitchat: boolean;
    },
    directory: string,
  ): string {
    const now = vnNow();
    const today = now.toISOString().slice(0, 10);
    const weekday = [
      'Chủ nhật',
      'Thứ 2',
      'Thứ 3',
      'Thứ 4',
      'Thứ 5',
      'Thứ 6',
      'Thứ 7',
    ][now.getUTCDay()];
    return [
      `Bạn là "${cfg.assistantName}" — trợ lý AI riêng của công ty, chạy trong phần mềm quản lý tuyển dụng / cung ứng lao động của công ty. Người dùng là nhân viên công ty, nói tiếng Việt, thường hỏi bằng giọng nói.`,
      cfg.persona
        ? `\n## Về bản thân bạn (do công ty đặt — khi được hỏi "bạn là ai", "ai tạo ra bạn"… hãy trả lời theo đúng phần này, không nói mình là Gemini hay do Google tạo)\n${cfg.persona.slice(0, 4000)}`
        : '',
      `\nHôm nay là ${weekday}, ${today} (giờ Việt Nam). Tuần bắt đầu từ Thứ 2.`,
      `Người đang hỏi: ${name} — vai trò ${ROLE_LABEL[role] ?? role}. Xưng hô lịch sự, thân thiện.`,
      cfg.knowledge
        ? `\n## Sổ tay công ty (thông tin công ty cung cấp — dùng để trả lời câu hỏi về công ty, sếp, quy trình, quy định…)\n${cfg.knowledge.slice(0, 30_000)}`
        : '',
      `
## Hướng dẫn sử dụng phần mềm & nghiệp vụ (dùng để hướng dẫn thao tác, giải thích chỉ số)
${APP_GUIDE}`,
      `\n## Danh bạ nội bộ (tự cập nhật từ phần mềm)\n${directory}`,
      '',
      '## Cách trả lời',
      '- Câu hỏi về công ty, con người, quy trình: trả lời theo Sổ tay và Danh bạ ở trên. Không có trong đó thì nói là chưa được cung cấp thông tin, không tự bịa.',
      '- Hỏi cách dùng phần mềm / ý nghĩa chỉ số: trả lời theo Hướng dẫn sử dụng, chỉ rõ vào trang nào, bấm gì. Có thể trả lời dài hơn (vài câu, đánh số bước nếu cần) vì đây là hướng dẫn. Không chắc thì nói nên hỏi Admin.',
      '- Câu hỏi về số liệu: luôn lấy bằng công cụ, KHÔNG tự bịa số. Không có công cụ phù hợp thì nói thẳng là trợ lý chưa xem được phần đó.',
      cfg.allowChitchat
        ? '- Được trò chuyện ngoài lề: tâm sự, hỏi kiến thức chung, chuyện đời thường — đáp tự nhiên, ấm áp, tích cực như một đồng nghiệp tốt; có thể dài hơn khi cần (vẫn gọn, dễ đọc thành tiếng). Không tư vấn y tế/pháp lý thay chuyên gia; chuyện nghiêm trọng (sức khoẻ, an toàn) thì khuyên tìm người thân hoặc chuyên gia.'
        : '- CHỈ hỗ trợ công việc công ty. Câu hỏi ngoài lề (tâm sự, chuyện riêng, kiến thức không liên quan công việc) thì lịch sự từ chối 1 câu và gợi ý hỏi về công việc.',
      '- Trả lời tiếng Việt, ngắn gọn 1–3 câu (trừ khi đang trò chuyện ngoài lề được phép), dễ đọc thành tiếng: không dùng bảng, gạch đầu dòng, ký hiệu markdown.',
      '- Công cụ trả "error" (ví dụ không có quyền) thì báo lại đúng ý đó, không đoán.',
      '- Câu hỏi không nói kỳ nào thì hiểu là hôm nay. "Tháng này", "tháng 10"… là cả tháng (by_person = true); ngày, tuần, vài ngày thì by_person = false.',
      '- "Chạy được bao nhiêu số", "bao nhiêu data" = data mới (new_leads).',
      '- Nghiệp vụ: Hẹn PV = số dòng Đưa đón; Đến = Tình trạng "Đã đón"; Bùng = "Chưa đón được"; Đỗ PV = Đã đón và Kết quả trống hoặc "Đỗ PV"; Trượt = Đã đón và "Trượt PV".',
      '- Tiền đọc theo đồng, ví dụ "1,2 triệu đồng". Số liệu chỉ trong phạm vi người hỏi được xem — không nói về phần bị ẩn.',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }

  private async moduleOk(user: AuthenticatedUser, code: string) {
    const level = await this.modules.getEffective(user.id, user.role, code);
    return level !== 'none';
  }

  private range(args: Record<string, unknown>) {
    const from = str(args.from);
    const to = str(args.to);
    if (!DATE.test(from) || !DATE.test(to) || from > to) {
      throw new Error('Khoảng ngày không hợp lệ (cần YYYY-MM-DD)');
    }
    return { from, to };
  }

  /** Cùng cách gửi khoảng ngày như Dashboard (frontend) để số khớp màn hình. */
  private dashboardQuery(from: string, to: string, byPerson: boolean) {
    return {
      date_from: `${from}T00:00:00.000Z`,
      date_to: new Date(`${to}T23:59:59.999+07:00`).toISOString(),
      ...(byPerson ? { count_by: 'person' as const } : {}),
    };
  }

  private async runTool(
    name: string,
    args: Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<unknown> {
    const deny = (what: string) => ({
      error: `Người hỏi không có quyền xem ${what}`,
    });
    switch (name) {
      case 'dashboard_kpi': {
        if (!(await this.moduleOk(user, 'dashboard'))) return deny('Dashboard');
        const { from, to } = this.range(args);
        const q = this.dashboardQuery(from, to, args.by_person === true);
        const [summary, teams, people] = await Promise.all([
          this.dashboard.getSummary({ ...q }, user),
          this.dashboard.getByTeam({ ...q }, user).catch(() => []),
          this.dashboard.getPerformance({ ...q }, user).catch(() => []),
        ]);
        return {
          from,
          to,
          count_unit: args.by_person === true ? 'người' : 'lượt',
          company_or_scope: summary,
          by_team: teams,
          by_person: people,
        };
      }
      case 'top_ranking': {
        if (!(await this.moduleOk(user, 'dashboard'))) return deny('Dashboard');
        const { from, to } = this.range(args);
        return this.dashboard.getRanking(
          this.dashboardQuery(from, to, false),
          user,
        );
      }
      case 'shuttle_stats': {
        if (!(await this.moduleOk(user, 'shuttle')))
          return deny('Danh sách đưa đón');
        const { from, to } = this.range(args);
        return this.shuttleStats(from, to);
      }
      case 'marketing_cost': {
        if (!can(user, 'dashboard.mkt_cost')) return deny('chi phí marketing');
        const { from, to } = this.range(args);
        return this.marketing.today({ from, to });
      }
      case 'ad_accounts': {
        if (!(await this.moduleOk(user, 'marketing-hub')))
          return deny('Marketing Hub');
        const { from, to } = this.range(args);
        const o = await this.marketing.overview({ from, to });
        const names = await this.prisma.account.findMany({
          where: { id: { in: Object.keys(o.data_by_owner) } },
          select: { id: true, fullName: true },
        });
        const nameOf = new Map(names.map((n) => [n.id, n.fullName]));
        return {
          from,
          to,
          total_spend: o.total_spend,
          data_total: o.data_total,
          data_by_mkt: Object.entries(o.data_by_owner).map(([id, n]) => ({
            name: nameOf.get(id) ?? '?',
            data: n,
          })),
          accounts: o.items.map((a) => ({
            name: a.name,
            platform: a.platform,
            owner: a.owner.full_name,
            spend: a.total_spend,
            balance: a.balance,
            health: a.account_health,
            has_active_campaign: a.has_active_campaign,
            connected: a.status,
          })),
        };
      }
      case 'lead_colors': {
        if (!(await this.moduleOk(user, 'candidates')))
          return deny('Data lao động');
        const { from, to } = this.range(args);
        return this.leadColors(from, to, user);
      }
      case 'care_progress': {
        if (!(await this.moduleOk(user, 'dashboard'))) return deny('Dashboard');
        const month = str(args.month);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
          throw new Error('Tháng cần dạng YYYY-MM');
        return this.care.progress({ month }, user);
      }
      default:
        return { error: `Không có công cụ ${name}` };
    }
  }

  /**
   * Số data theo màu bôi — phạm vi như Hiệu suất Dashboard: dashboard.perf_all = toàn công ty,
   * dashboard.perf_team = nhóm mình, còn lại = số mình đang giữ. Không gửi tên/SĐT lao động.
   */
  private async leadColors(from: string, to: string, user: AuthenticatedUser) {
    const scope = can(user, 'dashboard.perf_all')
      ? {}
      : can(user, 'dashboard.perf_team')
        ? {
            assignedTeamId:
              (await findOwnTeamId(this.prisma, user.id)) ?? NO_MATCH_UUID,
          }
        : { assignedToId: user.id };
    const rows = await this.prisma.lead.groupBy({
      by: ['noteColor', 'assignedToId'],
      where: {
        deletedAt: null,
        uploadedAt: { gte: vnDayRange(from).start, lt: vnDayRange(to).end },
        ...scope,
      },
      _count: { _all: true },
    });
    const ids = [
      ...new Set(
        rows.map((r) => r.assignedToId).filter((x): x is string => !!x),
      ),
    ];
    const names = new Map(
      (
        await this.prisma.account.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true },
        })
      ).map((a) => [a.id, a.fullName]),
    );
    const label = (c: string | null) =>
      c === 'red'
        ? 'đỏ'
        : c === 'yellow'
          ? 'vàng'
          : c === 'green'
            ? 'xanh'
            : 'chưa bôi';
    const total: Record<string, number> = {};
    const byPerson: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const color = label(r.noteColor);
      const who = r.assignedToId
        ? (names.get(r.assignedToId) ?? '?')
        : '(chưa chia)';
      total[color] = (total[color] ?? 0) + r._count._all;
      byPerson[who] ??= {};
      byPerson[who][color] = (byPerson[who][color] ?? 0) + r._count._all;
    }
    return { from, to, total, by_person: byPerson };
  }

  /** Chỉ số đếm gộp — không gửi tên / SĐT lao động cho AI. */
  private async shuttleStats(from: string, to: string) {
    const rows = await this.prisma.shuttleRecord.findMany({
      where: {
        deletedAt: null,
        date: {
          gte: new Date(`${from}T00:00:00.000Z`),
          lte: new Date(`${to}T00:00:00.000Z`),
        },
      },
      select: {
        date: true,
        status: true,
        interviewResult: true,
        area: true,
        type: true,
        leadSource: true,
        company: { select: { name: true } },
        saleUser: { select: { fullName: true } },
        driverUser: { select: { fullName: true } },
      },
    });
    const tally = (
      key: (r: (typeof rows)[number]) => string | null | undefined,
    ) => {
      const m: Record<string, number> = {};
      for (const r of rows) {
        const k = key(r) || '(trống)';
        m[k] = (m[k] ?? 0) + 1;
      }
      return m;
    };
    const attended = rows.filter((r) => r.status === SHUTTLE_STATUS_ATTENDED);
    return {
      from,
      to,
      total_rows: rows.length,
      attended: attended.length,
      no_show: rows.filter((r) => r.status === SHUTTLE_STATUS_NO_SHOW).length,
      passed: attended.filter(
        (r) =>
          !r.interviewResult || r.interviewResult === SHUTTLE_RESULT_PASSED,
      ).length,
      failed: attended.filter(
        (r) => r.interviewResult === SHUTTLE_RESULT_FAILED,
      ).length,
      by_status: tally((r) => r.status),
      by_day: tally((r) => r.date.toISOString().slice(0, 10)),
      by_company: tally((r) => r.company?.name),
      by_sale: tally((r) => r.saleUser?.fullName),
      by_driver: tally((r) => r.driverUser?.fullName),
      by_area: tally((r) => r.area),
      by_type: tally((r) => r.type),
      by_source: tally((r) => r.leadSource),
    };
  }
}

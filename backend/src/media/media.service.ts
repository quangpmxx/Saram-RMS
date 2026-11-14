import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { can } from '../common/permissions/capability-catalog';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { vnDateOnly, vnMonthKey } from '../care-warehouse/care-time.util';
import type { Prisma } from '../../generated/prisma/client';
import type { MediaTaskStatus } from '../../generated/prisma/enums';
import {
  CreateMediaTaskDto,
  MediaCampaignDto,
  MediaIdeaDto,
  MediaMetricsDto,
  MediaPlanDto,
  MediaPublicationDto,
  MediaReviewDto,
  MediaSubmitDto,
  UpdateMediaTaskDto,
} from './dto/media.dto';

/** File sản phẩm: thư mục RIÊNG (không công khai), chỉ tải qua API có kiểm quyền. */
const FILE_DIR = join(process.cwd(), 'private-uploads', 'media');
export const MEDIA_MAX_FILE_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.mp4',
  '.mov',
  '.webm',
  '.mp3',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.psd',
  '.ai',
  '.zip',
  '.rar',
  '.txt',
]);

const MEDIA_STAFF_ROLES = ['admin', 'manager', 'mkt', 'media_staff'] as const;

const STATUS_LABEL: Record<MediaTaskStatus, string> = {
  todo: 'Chờ thực hiện',
  in_progress: 'Đang thực hiện',
  in_review: 'Chờ duyệt',
  revision: 'Cần chỉnh sửa',
  done: 'Hoàn thành',
};

export function mediaCode(code: number): string {
  return `MD-${String(code).padStart(6, '0')}`;
}

/** Bỏ dấu + viết thường + gộp khoảng trắng — so trùng ý tưởng. */
export function normalizeTitle(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Độ giống 2 tiêu đề (0–1): tỉ lệ từ chung (Jaccard), chứa nhau tính là 1. */
export function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b || a.includes(b) || b.includes(a)) return 1;
  const sa = new Set(a.split(' ').filter((w) => w.length > 1));
  const sb = new Set(b.split(' ').filter((w) => w.length > 1));
  if (!sa.size || !sb.size) return 0;
  let common = 0;
  for (const w of sa) if (sb.has(w)) common++;
  return common / (sa.size + sb.size - common);
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime()))
    throw new BadRequestException('Ngày không hợp lệ');
  return d;
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** Thứ Hai đầu tuần (giờ VN) của 1 thời điểm, dạng YYYY-MM-DD. */
function vnWeekKey(date: Date): string {
  const day = new Date(`${vnDateOnly(date)}T00:00:00Z`);
  const dow = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - dow);
  return day.toISOString().slice(0, 10);
}

type TaskWithRelations = Prisma.MediaTaskGetPayload<{
  include: {
    members: true;
    plan: { select: { id: true; title: true } };
    campaign: { select: { id: true; name: true } };
    idea: { select: { id: true; title: true } };
    submissions: {
      orderBy: { version: 'desc' };
      take: 1;
      select: { version: true; reviewStatus: true; submittedAt: true };
    };
  };
}>;

const TASK_INCLUDE = {
  members: true,
  plan: { select: { id: true, title: true } },
  campaign: { select: { id: true, name: true } },
  idea: { select: { id: true, title: true } },
  submissions: {
    orderBy: { version: 'desc' as const },
    take: 1,
    select: { version: true, reviewStatus: true, submittedAt: true },
  },
} satisfies Prisma.MediaTaskInclude;

export interface PersonRef {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ============================================================ quyền
  private canAssign(user: AuthenticatedUser): boolean {
    return can(user, 'media.assign');
  }

  private canReview(user: AuthenticatedUser): boolean {
    return can(user, 'media.review');
  }

  /** Thấy mọi công việc: người giao việc / duyệt / xem báo cáo. */
  private seesAllTasks(user: AuthenticatedUser): boolean {
    return (
      this.canAssign(user) ||
      this.canReview(user) ||
      can(user, 'media.view_report')
    );
  }

  private require(user: AuthenticatedUser, code: string, message: string) {
    if (!can(user, code)) throw new ForbiddenException(message);
  }

  private taskScope(user: AuthenticatedUser): Prisma.MediaTaskWhereInput {
    if (this.seesAllTasks(user)) return {};
    return {
      OR: [
        { assigneeId: user.id },
        { createdById: user.id },
        { members: { some: { accountId: user.id } } },
      ],
    };
  }

  private isParticipant(
    task: { assigneeId: string | null; members: { accountId: string }[] },
    user: AuthenticatedUser,
  ): boolean {
    return (
      task.assigneeId === user.id ||
      task.members.some((m) => m.accountId === user.id)
    );
  }

  // ============================================================ tra tên
  private async people(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    const map = new Map<string, PersonRef>();
    if (!unique.length) return map;
    const rows = await this.prisma.account.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        fullName: true,
        nickname: true,
        avatarUrl: true,
        role: true,
      },
    });
    for (const r of rows) {
      map.set(r.id, {
        id: r.id,
        name: r.nickname || r.fullName,
        avatar_url: r.avatarUrl,
        role: r.role,
      });
    }
    return map;
  }

  private async companies(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    const map = new Map<string, string>();
    if (!unique.length) return map;
    const rows = await this.prisma.orderRecord.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    for (const r of rows) map.set(r.id, r.name);
    return map;
  }

  /** Danh mục cho form: nhân viên Media, công ty, chiến dịch, kế hoạch, quyền của tôi. */
  async options(user: AuthenticatedUser) {
    const [staff, companies, campaigns, plans] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          status: 'active',
          deletedAt: null,
          role: { in: [...MEDIA_STAFF_ROLES] },
        },
        select: {
          id: true,
          fullName: true,
          nickname: true,
          avatarUrl: true,
          role: true,
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.orderRecord.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.mediaCampaign.findMany({
        select: { id: true, name: true, active: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaPlan.findMany({
        select: { id: true, title: true, endDate: true },
        orderBy: { startDate: 'desc' },
        take: 100,
      }),
    ]);
    return {
      staff: staff.map((s) => ({
        id: s.id,
        name: s.nickname || s.fullName,
        avatar_url: s.avatarUrl,
        role: s.role,
      })),
      companies,
      campaigns,
      plans: plans.map((p) => ({ id: p.id, title: p.title })),
      me: {
        id: user.id,
        can_assign: this.canAssign(user),
        can_review: this.canReview(user),
        can_manage_plan: can(user, 'media.manage_plan'),
        can_manage_publish: can(user, 'media.manage_publish'),
        can_view_report: can(user, 'media.view_report'),
      },
    };
  }

  // ============================================================ chiến dịch
  async listCampaigns() {
    const rows = await this.prisma.mediaCampaign.findMany({
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { tasks: true, publications: true } } },
    });
    const names = await this.companies(rows.map((r) => r.companyId));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      company_id: r.companyId,
      company_name: r.companyId ? (names.get(r.companyId) ?? null) : null,
      factory: r.factory,
      start_date: r.startDate,
      end_date: r.endDate,
      note: r.note,
      active: r.active,
      task_count: r._count.tasks,
      publication_count: r._count.publications,
    }));
  }

  async saveCampaign(
    id: string | null,
    dto: MediaCampaignDto,
    user: AuthenticatedUser,
  ) {
    this.require(
      user,
      'media.manage_plan',
      'Bạn không có quyền quản lý chiến dịch',
    );
    const data = {
      name: dto.name.trim(),
      companyId: dto.company_id ?? null,
      factory: trimOrNull(dto.factory),
      startDate: toDate(dto.start_date),
      endDate: toDate(dto.end_date),
      note: trimOrNull(dto.note),
      active: dto.active ?? true,
    };
    if (id) {
      await this.findOr404(
        this.prisma.mediaCampaign.findUnique({ where: { id } }),
      );
      await this.prisma.mediaCampaign.update({ where: { id }, data });
    } else {
      await this.prisma.mediaCampaign.create({
        data: { ...data, createdById: user.id },
      });
    }
    return { ok: true };
  }

  async removeCampaign(id: string, user: AuthenticatedUser) {
    this.require(
      user,
      'media.manage_plan',
      'Bạn không có quyền quản lý chiến dịch',
    );
    await this.findOr404(
      this.prisma.mediaCampaign.findUnique({ where: { id } }),
    );
    await this.prisma.mediaCampaign.delete({ where: { id } });
    return { ok: true };
  }

  // ============================================================ kế hoạch
  async listPlans(from?: string, to?: string) {
    const where: Prisma.MediaPlanWhereInput = {};
    if (from) where.endDate = { gte: toDate(from)! };
    if (to) where.startDate = { lte: toDate(to)! };
    const rows = await this.prisma.mediaPlan.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        campaign: { select: { id: true, name: true } },
        tasks: { select: { type: true, status: true } },
      },
    });
    const names = await this.companies(rows.map((r) => r.companyId));
    return rows.map((r) => {
      const count = (type: string, onlyDone: boolean) =>
        r.tasks.filter(
          (t) => t.type === type && (!onlyDone || t.status === 'done'),
        ).length;
      return {
        id: r.id,
        title: r.title,
        period_type: r.periodType,
        start_date: r.startDate,
        end_date: r.endDate,
        company_id: r.companyId,
        company_name: r.companyId ? (names.get(r.companyId) ?? null) : null,
        factory: r.factory,
        campaign: r.campaign,
        platforms: r.platforms,
        note: r.note,
        targets: {
          video: r.targetVideos,
          post: r.targetPosts,
          livestream: r.targetLivestreams,
        },
        planned: {
          video: count('video', false),
          post: count('post', false),
          livestream: count('livestream', false),
        },
        done: {
          video: count('video', true),
          post: count('post', true),
          livestream: count('livestream', true),
        },
        task_count: r.tasks.length,
      };
    });
  }

  async savePlan(
    id: string | null,
    dto: MediaPlanDto,
    user: AuthenticatedUser,
  ) {
    this.require(
      user,
      'media.manage_plan',
      'Bạn không có quyền quản lý kế hoạch',
    );
    const start = toDate(dto.start_date)!;
    const end = toDate(dto.end_date)!;
    if (end < start)
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    const data = {
      title: dto.title.trim(),
      periodType: dto.period_type,
      startDate: start,
      endDate: end,
      companyId: dto.company_id ?? null,
      factory: trimOrNull(dto.factory),
      campaignId: dto.campaign_id ?? null,
      platforms: dto.platforms ?? [],
      targetVideos: dto.target_videos ?? 0,
      targetPosts: dto.target_posts ?? 0,
      targetLivestreams: dto.target_livestreams ?? 0,
      note: trimOrNull(dto.note),
    };
    if (id) {
      await this.findOr404(this.prisma.mediaPlan.findUnique({ where: { id } }));
      await this.prisma.mediaPlan.update({ where: { id }, data });
    } else {
      await this.prisma.mediaPlan.create({
        data: { ...data, createdById: user.id },
      });
    }
    return { ok: true };
  }

  async removePlan(id: string, user: AuthenticatedUser) {
    this.require(
      user,
      'media.manage_plan',
      'Bạn không có quyền quản lý kế hoạch',
    );
    await this.findOr404(this.prisma.mediaPlan.findUnique({ where: { id } }));
    await this.prisma.mediaPlan.delete({ where: { id } });
    return { ok: true };
  }

  // ============================================================ công việc
  async listTasks(
    user: AuthenticatedUser,
    query: {
      status?: string;
      assignee_id?: string;
      campaign_id?: string;
      plan_id?: string;
      q?: string;
      mine?: string;
    },
  ) {
    const and: Prisma.MediaTaskWhereInput[] = [this.taskScope(user)];
    if (query.status) and.push({ status: query.status as MediaTaskStatus });
    if (query.assignee_id) {
      and.push({
        OR: [
          { assigneeId: query.assignee_id },
          { members: { some: { accountId: query.assignee_id } } },
        ],
      });
    }
    if (query.mine === '1') {
      and.push({
        OR: [
          { assigneeId: user.id },
          { members: { some: { accountId: user.id } } },
        ],
      });
    }
    if (query.campaign_id) and.push({ campaignId: query.campaign_id });
    if (query.plan_id) and.push({ planId: query.plan_id });
    const q = query.q?.trim();
    if (q) {
      const codeMatch = /^md-?0*(\d+)$/i.exec(q);
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { factory: { contains: q, mode: 'insensitive' } },
          ...(codeMatch ? [{ code: Number(codeMatch[1]) }] : []),
        ],
      });
    }
    const rows = await this.prisma.mediaTask.findMany({
      where: { AND: and },
      include: TASK_INCLUDE,
      orderBy: [
        { deadline: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 500,
    });
    return this.mapTasks(rows);
  }

  private async mapTasks(rows: TaskWithRelations[]) {
    const people = await this.people(
      rows.flatMap((r) => [
        r.assigneeId,
        r.createdById,
        ...r.members.map((m) => m.accountId),
      ]),
    );
    const names = await this.companies(rows.map((r) => r.companyId));
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      code: mediaCode(r.code),
      title: r.title,
      description: r.description,
      type: r.type,
      status: r.status,
      priority: r.priority,
      deadline: r.deadline,
      overdue:
        !!r.deadline && r.status !== 'done' && r.deadline.getTime() < now,
      progress: r.progress,
      platform: r.platform,
      plan: r.plan,
      campaign: r.campaign,
      idea: r.idea,
      company_id: r.companyId,
      company_name: r.companyId ? (names.get(r.companyId) ?? null) : null,
      factory: r.factory,
      assignee: r.assigneeId ? (people.get(r.assigneeId) ?? null) : null,
      members: r.members
        .map((m) => people.get(m.accountId))
        .filter((p): p is PersonRef => !!p),
      created_by: people.get(r.createdById) ?? null,
      latest_submission: r.submissions[0]
        ? {
            version: r.submissions[0].version,
            review_status: r.submissions[0].reviewStatus,
            submitted_at: r.submissions[0].submittedAt,
          }
        : null,
      completed_at: r.completedAt,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  }

  private async loadTask(id: string, user: AuthenticatedUser) {
    const task = await this.prisma.mediaTask.findFirst({
      where: { AND: [{ id }, this.taskScope(user)] },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return task;
  }

  async getTask(id: string, user: AuthenticatedUser) {
    const task = await this.loadTask(id, user);
    const [mapped] = await this.mapTasks([task]);
    const [activities, submissions] = await Promise.all([
      this.prisma.mediaTaskActivity.findMany({
        where: { taskId: id },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      this.prisma.mediaSubmission.findMany({
        where: { taskId: id },
        orderBy: { version: 'desc' },
      }),
    ]);
    const people = await this.people([
      ...activities.map((a) => a.accountId),
      ...submissions.flatMap((s) => [s.submittedById, s.reviewedById]),
    ]);
    return {
      ...mapped,
      activities: activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        content: a.content,
        created_at: a.createdAt,
        account: people.get(a.accountId) ?? null,
      })),
      submissions: submissions.map((s) => this.mapSubmission(s, people)),
      can: {
        edit: this.canAssign(user),
        work: this.isParticipant(task, user) || this.canAssign(user),
        review: this.canReview(user),
      },
    };
  }

  private mapSubmission(
    s: {
      id: string;
      version: number;
      link: string | null;
      fileName: string | null;
      filePath: string | null;
      note: string | null;
      submittedById: string;
      submittedAt: Date;
      reviewStatus: string;
      reviewNote: string | null;
      reviewedById: string | null;
      reviewedAt: Date | null;
    },
    people: Map<string, PersonRef>,
  ) {
    return {
      id: s.id,
      version: s.version,
      link: s.link,
      file_name: s.fileName,
      has_file: !!s.filePath,
      note: s.note,
      submitted_by: people.get(s.submittedById) ?? null,
      submitted_at: s.submittedAt,
      review_status: s.reviewStatus,
      review_note: s.reviewNote,
      reviewed_by: s.reviewedById ? (people.get(s.reviewedById) ?? null) : null,
      reviewed_at: s.reviewedAt,
    };
  }

  private async assertPeople(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return;
    const found = await this.prisma.account.count({
      where: { id: { in: unique }, status: 'active', deletedAt: null },
    });
    if (found !== unique.length) {
      throw new BadRequestException(
        'Có người được chọn không tồn tại hoặc đã nghỉ',
      );
    }
  }

  async createTask(dto: CreateMediaTaskDto, user: AuthenticatedUser) {
    this.require(user, 'media.assign', 'Bạn không có quyền tạo / giao việc');
    const title = dto.title?.trim();
    if (!title)
      throw new BadRequestException('Tên nội dung không được để trống');
    const memberIds = [...new Set(dto.member_ids ?? [])].filter(
      (m) => m !== dto.assignee_id,
    );
    await this.assertPeople([dto.assignee_id, ...memberIds]);
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.mediaTask.create({
        data: {
          title,
          description: trimOrNull(dto.description),
          type: dto.type ?? 'video',
          priority: dto.priority ?? 'normal',
          deadline: toDate(dto.deadline),
          platform: dto.platform ?? null,
          planId: dto.plan_id ?? null,
          campaignId: dto.campaign_id ?? null,
          ideaId: dto.idea_id ?? null,
          companyId: dto.company_id ?? null,
          factory: trimOrNull(dto.factory),
          assigneeId: dto.assignee_id ?? null,
          createdById: user.id,
          members: { create: memberIds.map((accountId) => ({ accountId })) },
        },
      });
      await tx.mediaTaskActivity.create({
        data: {
          taskId: created.id,
          accountId: user.id,
          kind: 'created',
          content: 'Tạo công việc',
        },
      });
      if (dto.idea_id) {
        await tx.mediaIdea.updateMany({
          where: { id: dto.idea_id, status: { in: ['new', 'approved'] } },
          data: { status: 'used' },
        });
      }
      return created;
    });
    await this.notify(
      [dto.assignee_id, ...memberIds],
      `Bạn được giao việc Media ${mediaCode(task.code)}: ${title}`,
      user,
      task.id,
    );
    return { id: task.id, code: mediaCode(task.code) };
  }

  async updateTask(
    id: string,
    dto: UpdateMediaTaskDto,
    user: AuthenticatedUser,
  ) {
    this.require(user, 'media.assign', 'Bạn không có quyền sửa công việc');
    const task = await this.loadTask(id, user);
    const data: Prisma.MediaTaskUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined)
      data.description = trimOrNull(dto.description);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.deadline !== undefined) data.deadline = toDate(dto.deadline);
    if (dto.platform !== undefined) data.platform = dto.platform;
    if (dto.plan_id !== undefined) data.planId = dto.plan_id;
    if (dto.campaign_id !== undefined) data.campaignId = dto.campaign_id;
    if (dto.idea_id !== undefined) data.ideaId = dto.idea_id;
    if (dto.company_id !== undefined) data.companyId = dto.company_id;
    if (dto.factory !== undefined) data.factory = trimOrNull(dto.factory);
    if (dto.assignee_id !== undefined) data.assigneeId = dto.assignee_id;

    const assigneeId =
      dto.assignee_id !== undefined ? dto.assignee_id : task.assigneeId;
    const oldIds = new Set([
      task.assigneeId,
      ...task.members.map((m) => m.accountId),
    ]);
    let memberIds: string[] | null = null;
    if (dto.member_ids !== undefined) {
      memberIds = [...new Set(dto.member_ids)].filter((m) => m !== assigneeId);
    }
    await this.assertPeople([dto.assignee_id, ...(memberIds ?? [])]);

    await this.prisma.$transaction(async (tx) => {
      await tx.mediaTask.update({ where: { id }, data });
      if (memberIds) {
        await tx.mediaTaskMember.deleteMany({ where: { taskId: id } });
        if (memberIds.length) {
          await tx.mediaTaskMember.createMany({
            data: memberIds.map((accountId) => ({ taskId: id, accountId })),
          });
        }
      }
      await tx.mediaTaskActivity.create({
        data: {
          taskId: id,
          accountId: user.id,
          kind: 'updated',
          content: 'Cập nhật thông tin công việc',
        },
      });
    });

    const newcomers = [assigneeId, ...(memberIds ?? [])].filter(
      (x): x is string => !!x && !oldIds.has(x),
    );
    await this.notify(
      newcomers,
      `Bạn được giao việc Media ${mediaCode(task.code)}: ${dto.title?.trim() || task.title}`,
      user,
      id,
    );
    return { ok: true };
  }

  async removeTask(id: string, user: AuthenticatedUser) {
    this.require(user, 'media.assign', 'Bạn không có quyền xoá công việc');
    await this.loadTask(id, user);
    await this.prisma.mediaTask.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Đổi trạng thái thủ công. Người giao việc đổi tự do; người làm chỉ được
   * Chờ thực hiện / Cần chỉnh sửa → Đang thực hiện (và quay về Chờ thực hiện).
   * "Chờ duyệt" đi qua nộp sản phẩm, "Hoàn thành" đi qua duyệt.
   */
  async changeStatus(
    id: string,
    status: MediaTaskStatus,
    user: AuthenticatedUser,
  ) {
    const task = await this.loadTask(id, user);
    if (task.status === status) return { ok: true };
    if (!this.canAssign(user)) {
      if (!this.isParticipant(task, user)) {
        throw new ForbiddenException('Bạn không tham gia công việc này');
      }
      const allowed =
        (status === 'in_progress' &&
          ['todo', 'revision'].includes(task.status)) ||
        (status === 'todo' && task.status === 'in_progress');
      if (!allowed) {
        throw new BadRequestException(
          status === 'done' || status === 'in_review'
            ? 'Hãy nộp sản phẩm để chờ duyệt — người duyệt sẽ chuyển sang Hoàn thành'
            : 'Không đổi được sang trạng thái này',
        );
      }
    }
    await this.prisma.$transaction([
      this.prisma.mediaTask.update({
        where: { id },
        data: {
          status,
          completedAt: status === 'done' ? new Date() : null,
          ...(status === 'done' ? { progress: 100 } : {}),
        },
      }),
      this.prisma.mediaTaskActivity.create({
        data: {
          taskId: id,
          accountId: user.id,
          kind: 'status',
          content: `${STATUS_LABEL[task.status]} → ${STATUS_LABEL[status]}`,
        },
      }),
    ]);
    return { ok: true };
  }

  async changeProgress(id: string, progress: number, user: AuthenticatedUser) {
    const task = await this.loadTask(id, user);
    if (!this.isParticipant(task, user) && !this.canAssign(user)) {
      throw new ForbiddenException('Bạn không tham gia công việc này');
    }
    if (task.status === 'done')
      throw new BadRequestException('Công việc đã hoàn thành');
    await this.prisma.$transaction([
      this.prisma.mediaTask.update({
        where: { id },
        data: {
          progress,
          ...(task.status === 'todo' && progress > 0
            ? { status: 'in_progress' }
            : {}),
        },
      }),
      this.prisma.mediaTaskActivity.create({
        data: {
          taskId: id,
          accountId: user.id,
          kind: 'progress',
          content: `Tiến độ ${task.progress}% → ${progress}%`,
        },
      }),
    ]);
    return { ok: true };
  }

  async comment(id: string, content: string, user: AuthenticatedUser) {
    await this.loadTask(id, user);
    await this.prisma.mediaTaskActivity.create({
      data: {
        taskId: id,
        accountId: user.id,
        kind: 'comment',
        content: content.trim(),
      },
    });
    return { ok: true };
  }

  // ============================================================ nộp & duyệt
  async submit(
    id: string,
    dto: MediaSubmitDto,
    file: Express.Multer.File | undefined,
    user: AuthenticatedUser,
  ) {
    const task = await this.loadTask(id, user);
    if (!this.isParticipant(task, user) && !this.canAssign(user)) {
      throw new ForbiddenException('Bạn không tham gia công việc này');
    }
    if (task.status === 'done')
      throw new BadRequestException('Công việc đã hoàn thành');
    const link = trimOrNull(dto.link);
    if (!link && !file) {
      throw new BadRequestException('Nhập link sản phẩm hoặc đính kèm file');
    }
    if (link && !/^https?:\/\//i.test(link)) {
      throw new BadRequestException(
        'Link phải bắt đầu bằng http:// hoặc https://',
      );
    }
    let filePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const ext = extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        throw new BadRequestException('Định dạng file không được hỗ trợ');
      }
      await mkdir(FILE_DIR, { recursive: true });
      filePath = `${randomUUID()}${ext}`;
      // Tên gốc: multer đọc latin1 — đổi lại utf8 để giữ tiếng Việt.
      fileName = Buffer.from(file.originalname, 'latin1')
        .toString('utf8')
        .slice(0, 255);
      await writeFile(join(FILE_DIR, filePath), file.buffer);
    }
    const submission = await this.prisma.$transaction(async (tx) => {
      const last = await tx.mediaSubmission.findFirst({
        where: { taskId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (last?.version ?? 0) + 1;
      // Phiên bản cũ còn chờ duyệt → coi như đã thay bằng bản mới.
      await tx.mediaSubmission.updateMany({
        where: { taskId: id, reviewStatus: 'pending' },
        data: { reviewStatus: 'superseded' },
      });
      const created = await tx.mediaSubmission.create({
        data: {
          taskId: id,
          version,
          link,
          filePath,
          fileName,
          note: trimOrNull(dto.note),
          submittedById: user.id,
        },
      });
      await tx.mediaTask.update({
        where: { id },
        data: { status: 'in_review', progress: Math.max(task.progress, 90) },
      });
      await tx.mediaTaskActivity.create({
        data: {
          taskId: id,
          accountId: user.id,
          kind: 'submit',
          content: `Nộp sản phẩm phiên bản ${version}`,
        },
      });
      return created;
    });
    await this.notify(
      [task.createdById],
      `Sản phẩm ${mediaCode(task.code)} (v${submission.version}) chờ duyệt: ${task.title}`,
      user,
      id,
    );
    return { id: submission.id, version: submission.version };
  }

  async review(
    submissionId: string,
    dto: MediaReviewDto,
    user: AuthenticatedUser,
  ) {
    this.require(user, 'media.review', 'Bạn không có quyền duyệt sản phẩm');
    const note = trimOrNull(dto.note);
    if (dto.decision === 'revision' && !note) {
      throw new BadRequestException('Vui lòng ghi lý do cần chỉnh sửa');
    }
    const submission = await this.prisma.mediaSubmission.findUnique({
      where: { id: submissionId },
      include: { task: { include: { members: true } } },
    });
    if (!submission) throw new NotFoundException('Không tìm thấy sản phẩm');
    // Chặn 2 người duyệt cùng lúc: chỉ cập nhật khi còn "pending".
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mediaSubmission.updateMany({
        where: { id: submissionId, reviewStatus: 'pending' },
        data: {
          reviewStatus: dto.decision,
          reviewNote: note,
          reviewedById: user.id,
          reviewedAt: now,
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(
          'Phiên bản này đã được duyệt hoặc đã có bản mới hơn',
        );
      }
      await tx.mediaTask.update({
        where: { id: submission.taskId },
        data:
          dto.decision === 'approved'
            ? { status: 'done', completedAt: now, progress: 100 }
            : { status: 'revision', completedAt: null },
      });
      await tx.mediaTaskActivity.create({
        data: {
          taskId: submission.taskId,
          accountId: user.id,
          kind: 'review',
          content:
            dto.decision === 'approved'
              ? `Duyệt phiên bản ${submission.version} — Hoàn thành${note ? `: ${note}` : ''}`
              : `Yêu cầu chỉnh sửa phiên bản ${submission.version}: ${note}`,
        },
      });
    });
    const task = submission.task;
    await this.notify(
      [
        task.assigneeId,
        ...task.members.map((m) => m.accountId),
        submission.submittedById,
      ],
      dto.decision === 'approved'
        ? `${mediaCode(task.code)} đã được duyệt: ${task.title}`
        : `${mediaCode(task.code)} cần chỉnh sửa: ${note}`,
      user,
      task.id,
    );
    return { ok: true };
  }

  /** Danh sách sản phẩm chờ duyệt (bản mới nhất mỗi việc). */
  async pendingReviews(user: AuthenticatedUser) {
    const rows = await this.prisma.mediaSubmission.findMany({
      where: { reviewStatus: 'pending', task: this.taskScope(user) },
      orderBy: { submittedAt: 'asc' },
      include: {
        task: {
          select: {
            id: true,
            code: true,
            title: true,
            type: true,
            deadline: true,
            priority: true,
          },
        },
      },
    });
    const people = await this.people(
      rows.flatMap((r) => [r.submittedById, r.reviewedById]),
    );
    return rows.map((r) => ({
      ...this.mapSubmission(r, people),
      task: { ...r.task, code: mediaCode(r.task.code) },
    }));
  }

  /** Lịch sử đã duyệt gần đây (người duyệt, phiên bản). */
  async reviewHistory(user: AuthenticatedUser) {
    const rows = await this.prisma.mediaSubmission.findMany({
      where: {
        reviewStatus: { in: ['approved', 'revision'] },
        task: this.taskScope(user),
      },
      orderBy: { reviewedAt: 'desc' },
      take: 100,
      include: {
        task: {
          select: {
            id: true,
            code: true,
            title: true,
            type: true,
            deadline: true,
            priority: true,
          },
        },
      },
    });
    const people = await this.people(
      rows.flatMap((r) => [r.submittedById, r.reviewedById]),
    );
    return rows.map((r) => ({
      ...this.mapSubmission(r, people),
      task: { ...r.task, code: mediaCode(r.task.code) },
    }));
  }

  async downloadFile(submissionId: string, user: AuthenticatedUser) {
    const row = await this.prisma.mediaSubmission.findUnique({
      where: { id: submissionId },
      select: { taskId: true, filePath: true, fileName: true },
    });
    if (!row?.filePath) throw new NotFoundException('Không có file');
    await this.loadTask(row.taskId, user);
    if (!/^[\w-]+\.[a-z0-9]+$/.test(row.filePath))
      throw new NotFoundException('Không có file');
    const full = join(FILE_DIR, row.filePath);
    if (!existsSync(full))
      throw new NotFoundException('File không còn trên máy chủ');
    return new StreamableFile(createReadStream(full), {
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName ?? row.filePath)}`,
    });
  }

  // ============================================================ ý tưởng
  async listIdeas(query: {
    q?: string;
    kind?: string;
    status?: string;
    campaign_id?: string;
  }) {
    const where: Prisma.MediaIdeaWhereInput = {};
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = query.status;
    if (query.campaign_id) where.campaignId = query.campaign_id;
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { titleKey: { contains: normalizeTitle(q) } },
        { topic: { contains: q, mode: 'insensitive' } },
        { factory: { contains: q, mode: 'insensitive' } },
        { script: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.mediaIdea.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 300,
      include: {
        campaign: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
    });
    const people = await this.people(rows.map((r) => r.createdById));
    const names = await this.companies(rows.map((r) => r.companyId));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      status: r.status,
      topic: r.topic,
      company_id: r.companyId,
      company_name: r.companyId ? (names.get(r.companyId) ?? null) : null,
      factory: r.factory,
      campaign: r.campaign,
      hook: r.hook,
      script: r.script,
      dialogue: r.dialogue,
      content: r.content,
      cta: r.cta,
      task_count: r._count.tasks,
      created_by: people.get(r.createdById) ?? null,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  }

  /** Ý tưởng có tiêu đề giống (≥ 50% từ chung) — cảnh báo trùng trước khi lưu. */
  async similarIdeas(title: string, excludeId?: string) {
    const key = normalizeTitle(title ?? '');
    if (key.length < 3) return [];
    const rows = await this.prisma.mediaIdea.findMany({
      where: excludeId ? { id: { not: excludeId } } : {},
      select: {
        id: true,
        title: true,
        titleKey: true,
        status: true,
        kind: true,
      },
    });
    return rows
      .map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        kind: r.kind,
        score: titleSimilarity(key, r.titleKey),
      }))
      .filter((r) => r.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  async saveIdea(
    id: string | null,
    dto: MediaIdeaDto,
    user: AuthenticatedUser,
  ) {
    const data = {
      title: dto.title.trim(),
      titleKey: normalizeTitle(dto.title),
      kind: dto.kind ?? 'video',
      status: dto.status ?? 'new',
      topic: trimOrNull(dto.topic),
      companyId: dto.company_id ?? null,
      factory: trimOrNull(dto.factory),
      campaignId: dto.campaign_id ?? null,
      hook: trimOrNull(dto.hook),
      script: trimOrNull(dto.script),
      dialogue: trimOrNull(dto.dialogue),
      content: trimOrNull(dto.content),
      cta: trimOrNull(dto.cta),
    };
    if (id) {
      const idea = await this.findOr404(
        this.prisma.mediaIdea.findUnique({ where: { id } }),
      );
      if (idea.createdById !== user.id && !this.canAssign(user)) {
        throw new ForbiddenException(
          'Chỉ người tạo hoặc người giao việc sửa được ý tưởng này',
        );
      }
      await this.prisma.mediaIdea.update({ where: { id }, data });
      return { id };
    }
    const created = await this.prisma.mediaIdea.create({
      data: { ...data, createdById: user.id },
    });
    return { id: created.id };
  }

  async removeIdea(id: string, user: AuthenticatedUser) {
    const idea = await this.findOr404(
      this.prisma.mediaIdea.findUnique({ where: { id } }),
    );
    if (idea.createdById !== user.id && !this.canAssign(user)) {
      throw new ForbiddenException(
        'Chỉ người tạo hoặc người giao việc xoá được ý tưởng này',
      );
    }
    await this.prisma.mediaIdea.delete({ where: { id } });
    return { ok: true };
  }

  // ============================================================ lịch xuất bản
  async listPublications(user: AuthenticatedUser, from?: string, to?: string) {
    const where: Prisma.MediaPublicationWhereInput = {};
    if (from || to) {
      where.scheduledDate = {
        ...(from ? { gte: toDate(from)! } : {}),
        ...(to ? { lte: toDate(to)! } : {}),
      };
    }
    const rows = await this.prisma.mediaPublication.findMany({
      where,
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
      take: 1000,
      include: {
        task: { select: { id: true, code: true, title: true } },
        campaign: { select: { id: true, name: true } },
      },
    });
    const people = await this.people(rows.map((r) => r.publisherId));
    const names = await this.companies(rows.map((r) => r.companyId));
    const manageAll = can(user, 'media.manage_publish');
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      task: r.task ? { ...r.task, code: mediaCode(r.task.code) } : null,
      campaign: r.campaign,
      company_id: r.companyId,
      company_name: r.companyId ? (names.get(r.companyId) ?? null) : null,
      factory: r.factory,
      scheduled_date: vnDateOnly(r.scheduledDate),
      platform: r.platform,
      channel: r.channel,
      publisher: r.publisherId ? (people.get(r.publisherId) ?? null) : null,
      status: r.status,
      link: r.link,
      published_at: r.publishedAt,
      note: r.note,
      metrics: {
        views: r.views,
        interactions: r.interactions,
        shares: r.shares,
        comments: r.comments,
        inbox: r.inbox,
        candidates: r.candidates,
        interviews: r.interviews,
        hired: r.hired,
      },
      metrics_source: r.metricsSource,
      metrics_updated_at: r.metricsUpdatedAt,
      can_edit:
        manageAll || r.publisherId === user.id || r.createdById === user.id,
    }));
  }

  private async editablePublication(id: string, user: AuthenticatedUser) {
    const row = await this.findOr404(
      this.prisma.mediaPublication.findUnique({ where: { id } }),
    );
    if (
      !can(user, 'media.manage_publish') &&
      row.publisherId !== user.id &&
      row.createdById !== user.id
    ) {
      throw new ForbiddenException('Bạn chỉ sửa được bài mình đăng / mình tạo');
    }
    return row;
  }

  async savePublication(
    id: string | null,
    dto: MediaPublicationDto,
    user: AuthenticatedUser,
  ) {
    const link = trimOrNull(dto.link);
    if (link && !/^https?:\/\//i.test(link)) {
      throw new BadRequestException(
        'Link phải bắt đầu bằng http:// hoặc https://',
      );
    }
    await this.assertPeople([dto.publisher_id]);
    // Gắn công việc: tự lấy công ty/nhà máy/chiến dịch của việc nếu chưa chọn.
    let fromTask: {
      companyId: string | null;
      factory: string | null;
      campaignId: string | null;
    } | null = null;
    if (dto.task_id) {
      fromTask = await this.prisma.mediaTask.findUnique({
        where: { id: dto.task_id },
        select: { companyId: true, factory: true, campaignId: true },
      });
      if (!fromTask)
        throw new BadRequestException('Không tìm thấy công việc được gắn');
    }
    const status = dto.status ?? (link ? 'published' : 'pending');
    const data = {
      title: dto.title.trim(),
      taskId: dto.task_id ?? null,
      campaignId: dto.campaign_id ?? fromTask?.campaignId ?? null,
      companyId: dto.company_id ?? fromTask?.companyId ?? null,
      factory: trimOrNull(dto.factory) ?? fromTask?.factory ?? null,
      scheduledDate: toDate(dto.scheduled_date)!,
      platform: dto.platform,
      channel: trimOrNull(dto.channel),
      publisherId: dto.publisher_id ?? null,
      status,
      link,
      note: trimOrNull(dto.note),
    };
    if (id) {
      const row = await this.editablePublication(id, user);
      await this.prisma.mediaPublication.update({
        where: { id },
        data: {
          ...data,
          publishedAt:
            status === 'published' ? (row.publishedAt ?? new Date()) : null,
        },
      });
      return { id };
    }
    const created = await this.prisma.mediaPublication.create({
      data: {
        ...data,
        publishedAt: status === 'published' ? new Date() : null,
        createdById: user.id,
      },
    });
    return { id: created.id };
  }

  async updateMetrics(
    id: string,
    dto: MediaMetricsDto,
    user: AuthenticatedUser,
  ) {
    await this.editablePublication(id, user);
    await this.prisma.mediaPublication.update({
      where: { id },
      data: { ...dto, metricsSource: 'manual', metricsUpdatedAt: new Date() },
    });
    return { ok: true };
  }

  async removePublication(id: string, user: AuthenticatedUser) {
    await this.editablePublication(id, user);
    await this.prisma.mediaPublication.delete({ where: { id } });
    return { ok: true };
  }

  // ============================================================ dashboard
  async dashboard(user: AuthenticatedUser) {
    const all = this.seesAllTasks(user);
    const tasks = await this.prisma.mediaTask.findMany({
      where: this.taskScope(user),
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        status: true,
        priority: true,
        deadline: true,
        assigneeId: true,
        completedAt: true,
        createdAt: true,
      },
    });
    const now = new Date();
    const nowMs = now.getTime();
    const counts = {
      total: tasks.length,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      revision: 0,
      done: 0,
      overdue: 0,
    };
    for (const t of tasks) {
      counts[t.status]++;
      if (t.deadline && t.status !== 'done' && t.deadline.getTime() < nowMs)
        counts.overdue++;
    }

    // Sản lượng theo nhân viên (người phụ trách chính): đã xong / đang làm, chia loại.
    const byStaff = new Map<
      string,
      {
        done: number;
        active: number;
        overdue: number;
        video: number;
        post: number;
        livestream: number;
        other: number;
      }
    >();
    for (const t of tasks) {
      if (!t.assigneeId) continue;
      const row = byStaff.get(t.assigneeId) ?? {
        done: 0,
        active: 0,
        overdue: 0,
        video: 0,
        post: 0,
        livestream: 0,
        other: 0,
      };
      if (t.status === 'done') {
        row.done++;
        const k =
          (['video', 'post', 'livestream'] as const).find(
            (x) => x === t.type,
          ) ?? 'other';
        row[k]++;
      } else {
        row.active++;
        if (t.deadline && t.deadline.getTime() < nowMs) row.overdue++;
      }
      byStaff.set(t.assigneeId, row);
    }
    const people = await this.people([...byStaff.keys()]);

    // Biểu đồ: hoàn thành / tạo mới theo 8 tuần và 6 tháng gần nhất (giờ VN).
    const weeks: string[] = [];
    for (let i = 7; i >= 0; i--)
      weeks.push(vnWeekKey(new Date(nowMs - i * 7 * 86_400_000)));
    const months: string[] = [];
    const [y, m] = vnMonthKey(now).split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
    const series = (keys: string[], keyOf: (d: Date) => string) =>
      keys.map((key) => ({
        key,
        done: tasks.filter((t) => t.completedAt && keyOf(t.completedAt) === key)
          .length,
        created: tasks.filter((t) => keyOf(t.createdAt) === key).length,
      }));

    const upcoming = tasks
      .filter(
        (t) =>
          t.status !== 'done' &&
          t.deadline &&
          t.deadline.getTime() < nowMs + 7 * 86_400_000,
      )
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())
      .slice(0, 10);
    const upPeople = await this.people(upcoming.map((t) => t.assigneeId));

    const pendingReview = await this.prisma.mediaSubmission.count({
      where: { reviewStatus: 'pending', task: this.taskScope(user) },
    });

    return {
      scope: all ? 'all' : 'mine',
      counts,
      pending_review: pendingReview,
      by_staff: [...byStaff.entries()]
        .map(([id, v]) => ({
          person: people.get(id) ?? {
            id,
            name: '—',
            avatar_url: null,
            role: '',
          },
          ...v,
        }))
        .sort((a, b) => b.done - a.done || b.active - a.active),
      weekly: series(weeks, vnWeekKey),
      monthly: series(months, vnMonthKey),
      upcoming: upcoming.map((t) => ({
        id: t.id,
        code: mediaCode(t.code),
        title: t.title,
        type: t.type,
        status: t.status,
        priority: t.priority,
        deadline: t.deadline,
        overdue: t.deadline!.getTime() < nowMs,
        assignee: t.assigneeId ? (upPeople.get(t.assigneeId) ?? null) : null,
      })),
    };
  }

  // ============================================================ báo cáo
  async report(user: AuthenticatedUser, from?: string, to?: string) {
    const all = can(user, 'media.view_report');
    const where: Prisma.MediaPublicationWhereInput = all
      ? {}
      : { publisherId: user.id };
    if (from || to) {
      where.scheduledDate = {
        ...(from ? { gte: toDate(from)! } : {}),
        ...(to ? { lte: toDate(to)! } : {}),
      };
    }
    const pubs = await this.prisma.mediaPublication.findMany({
      where,
      include: { campaign: { select: { id: true, name: true } } },
    });
    const taskWhere: Prisma.MediaTaskWhereInput = {
      status: 'done',
      ...(all ? {} : { assigneeId: user.id }),
      ...(from || to
        ? {
            completedAt: {
              ...(from ? { gte: toDate(from)! } : {}),
              ...(to
                ? { lt: new Date(toDate(to)!.getTime() + 86_400_000) }
                : {}),
            },
          }
        : {}),
    };
    const doneTasks = await this.prisma.mediaTask.findMany({
      where: taskWhere,
      select: { assigneeId: true, type: true, campaignId: true },
    });

    const METRICS = [
      'views',
      'interactions',
      'shares',
      'comments',
      'inbox',
      'candidates',
      'interviews',
      'hired',
    ] as const;
    type Totals = Record<(typeof METRICS)[number], number> & {
      posts: number;
      published: number;
    };
    const empty = (): Totals => ({
      posts: 0,
      published: 0,
      views: 0,
      interactions: 0,
      shares: 0,
      comments: 0,
      inbox: 0,
      candidates: 0,
      interviews: 0,
      hired: 0,
    });
    const add = (t: Totals, p: (typeof pubs)[number]) => {
      t.posts++;
      if (p.status === 'published') t.published++;
      for (const k of METRICS) t[k] += p[k];
    };
    const total = empty();
    const byPublisher = new Map<string, Totals>();
    const byCampaign = new Map<string, Totals & { name: string }>();
    const byFactory = new Map<
      string,
      Totals & { company_id: string | null; factory: string | null }
    >();
    const byPlatform = new Map<string, Totals>();
    for (const p of pubs) {
      add(total, p);
      const pk = p.publisherId ?? '';
      if (!byPublisher.has(pk)) byPublisher.set(pk, empty());
      add(byPublisher.get(pk)!, p);
      const ck = p.campaignId ?? '';
      if (!byCampaign.has(ck))
        byCampaign.set(ck, {
          ...empty(),
          name: p.campaign?.name ?? 'Chưa gắn chiến dịch',
        });
      add(byCampaign.get(ck)!, p);
      const fk = `${p.companyId ?? ''}|${p.factory ?? ''}`;
      if (!byFactory.has(fk))
        byFactory.set(fk, {
          ...empty(),
          company_id: p.companyId,
          factory: p.factory,
        });
      add(byFactory.get(fk)!, p);
      if (!byPlatform.has(p.platform)) byPlatform.set(p.platform, empty());
      add(byPlatform.get(p.platform)!, p);
    }
    const outputByStaff = new Map<
      string,
      {
        done: number;
        video: number;
        post: number;
        livestream: number;
        other: number;
      }
    >();
    for (const t of doneTasks) {
      if (!t.assigneeId) continue;
      const row = outputByStaff.get(t.assigneeId) ?? {
        done: 0,
        video: 0,
        post: 0,
        livestream: 0,
        other: 0,
      };
      row.done++;
      const k =
        (['video', 'post', 'livestream'] as const).find((x) => x === t.type) ??
        'other';
      row[k]++;
      outputByStaff.set(t.assigneeId, row);
    }
    const people = await this.people([
      ...byPublisher.keys(),
      ...outputByStaff.keys(),
    ]);
    const companyNames = await this.companies(
      [...byFactory.values()].map((v) => v.company_id),
    );
    const noOne = {
      id: '',
      name: 'Chưa chọn người đăng',
      avatar_url: null,
      role: '',
    };
    return {
      scope: all ? 'all' : 'mine',
      total,
      by_publisher: [...byPublisher.entries()]
        .map(([id, v]) => ({ person: (id && people.get(id)) || noOne, ...v }))
        .sort((a, b) => b.views - a.views),
      by_campaign: [...byCampaign.entries()]
        .map(([id, v]) => ({ id: id || null, ...v }))
        .sort((a, b) => b.views - a.views),
      by_factory: [...byFactory.values()]
        .map((v) => ({
          ...v,
          company_name: v.company_id
            ? (companyNames.get(v.company_id) ?? null)
            : null,
        }))
        .sort((a, b) => b.views - a.views),
      by_platform: [...byPlatform.entries()]
        .map(([platform, v]) => ({ platform, ...v }))
        .sort((a, b) => b.views - a.views),
      output_by_staff: [...outputByStaff.entries()]
        .map(([id, v]) => ({
          person: people.get(id) ?? { ...noOne, id, name: '—' },
          ...v,
        }))
        .sort((a, b) => b.done - a.done),
    };
  }

  // ============================================================ tiện ích
  private async findOr404<T>(promise: Promise<T | null>): Promise<T> {
    const row = await promise;
    if (!row) throw new NotFoundException('Không tìm thấy dữ liệu');
    return row;
  }

  /** Thông báo chuông; lỗi gửi không làm hỏng thao tác chính. Bỏ qua chính người thao tác. */
  private async notify(
    accountIds: (string | null | undefined)[],
    content: string,
    sender: AuthenticatedUser,
    taskId: string,
  ): Promise<void> {
    const ids = [
      ...new Set(accountIds.filter((x): x is string => !!x && x !== sender.id)),
    ];
    if (!ids.length) return;
    try {
      const now = new Date();
      for (const accountId of ids) {
        const notification = await this.prisma.notification.create({
          data: {
            accountId,
            type: 'media_task',
            channel: 'in_app',
            content: content.slice(0, 500),
            senderId: sender.id,
            scheduledAt: now,
            sentAt: now,
            status: 'sent',
            meta: { task_id: taskId },
          },
          include: {
            sender: {
              select: { id: true, fullName: true, role: true, avatarUrl: true },
            },
          },
        });
        this.realtime.emitNotificationCreated(
          toNotificationResponse(notification),
          sender,
        );
      }
    } catch (error) {
      this.logger.error(
        `Gửi thông báo Media thất bại (task=${taskId})`,
        error as Error,
      );
    }
  }
}

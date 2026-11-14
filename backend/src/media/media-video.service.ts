import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { can } from '../common/permissions/capability-catalog';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { vnDateOnly } from '../care-warehouse/care-time.util';
import type { Prisma } from '../../generated/prisma/client';
import { MediaService, mediaCode } from './media.service';
import {
  MediaChannelDto,
  MediaContentGroupDto,
  MediaVideoDto,
} from './dto/media-video.dto';

const STATUS_TEXT: Record<string, string> = {
  todo: 'Chưa dựng',
  in_progress: 'Đang dựng',
  in_review: 'Chờ duyệt',
  revision: 'Cần sửa',
  done: 'Xong',
};

const VIDEO_INCLUDE = {
  members: { select: { accountId: true } },
  contentGroup: { select: { id: true, name: true, colorKey: true } },
  publications: {
    orderBy: { createdAt: 'asc' as const },
    take: 1,
    include: {
      channelRecord: {
        select: { id: true, name: true, colorKey: true, platform: true },
      },
    },
  },
} satisfies Prisma.MediaTaskInclude;

type VideoRow = Prisma.MediaTaskGetPayload<{ include: typeof VIDEO_INCLUDE }>;

function linkOrNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) {
    throw new BadRequestException(
      'Link phải bắt đầu bằng http:// hoặc https://',
    );
  }
  return v;
}

function dateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value.slice(0, 10)) : null;
}

/** "dd/mm" theo giờ VN. */
function dayLabel(d: Date): string {
  const s = vnDateOnly(d);
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
}

/**
 * Sổ video (2026-11-14): bảng nhập nhanh kiểu sheet — mỗi dòng = 1 công việc
 * loại video (người quay = người phụ trách, người dựng, link thô/xong) + bài
 * đăng đầu tiên của việc đó (kênh, ngày đăng, đã đăng). Dùng chung dữ liệu với
 * tab Công việc / Lịch xuất bản / Báo cáo.
 */
@Injectable()
export class MediaVideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  // ============================================================ danh mục
  async catalog() {
    const [groups, channels] = await Promise.all([
      this.prisma.mediaContentGroup.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.mediaChannel.findMany({
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
    ]);
    const people = await this.media.people(channels.map((c) => c.ownerId));
    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        color_key: g.colorKey,
        sort_order: g.sortOrder,
      })),
      channels: channels.map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        url: c.url,
        color_key: c.colorKey,
        active: c.active,
        owner: c.ownerId ? (people.get(c.ownerId) ?? null) : null,
      })),
    };
  }

  private requireCatalog(user: AuthenticatedUser) {
    if (!can(user, 'media.manage_plan')) {
      throw new ForbiddenException('Bạn không có quyền sửa danh mục Media');
    }
  }

  async saveGroup(
    id: string | null,
    dto: MediaContentGroupDto,
    user: AuthenticatedUser,
  ) {
    this.requireCatalog(user);
    const data = {
      name: dto.name.trim(),
      colorKey: dto.color_key ?? null,
      sortOrder: dto.sort_order ?? 0,
    };
    const dup = await this.prisma.mediaContentGroup.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        ...(id ? { id: { not: id } } : {}),
      },
    });
    if (dup) throw new ConflictException('Đã có nhóm nội dung tên này');
    if (id) {
      await this.prisma.mediaContentGroup.update({ where: { id }, data });
    } else {
      await this.prisma.mediaContentGroup.create({ data });
    }
    return { ok: true };
  }

  async removeGroup(id: string, user: AuthenticatedUser) {
    this.requireCatalog(user);
    await this.prisma.mediaContentGroup.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Không tìm thấy nhóm');
    });
    return { ok: true };
  }

  async saveChannel(
    id: string | null,
    dto: MediaChannelDto,
    user: AuthenticatedUser,
  ) {
    this.requireCatalog(user);
    const data = {
      name: dto.name.trim(),
      platform: dto.platform ?? 'tiktok',
      url: linkOrNull(dto.url),
      ownerId: dto.owner_id ?? null,
      colorKey: dto.color_key ?? null,
      active: dto.active ?? true,
    };
    const dup = await this.prisma.mediaChannel.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        ...(id ? { id: { not: id } } : {}),
      },
    });
    if (dup) throw new ConflictException('Đã có kênh tên này');
    if (id) {
      await this.prisma.mediaChannel.update({ where: { id }, data });
    } else {
      await this.prisma.mediaChannel.create({ data });
    }
    return { ok: true };
  }

  async removeChannel(id: string, user: AuthenticatedUser) {
    this.requireCatalog(user);
    await this.prisma.mediaChannel.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Không tìm thấy kênh');
    });
    return { ok: true };
  }

  // ============================================================ danh sách
  async list(
    user: AuthenticatedUser,
    query: {
      month?: string;
      person_id?: string;
      group_id?: string;
      open?: string;
    },
  ) {
    const month = /^\d{4}-\d{2}$/.test(query.month ?? '')
      ? query.month!
      : vnDateOnly(new Date()).slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    // createdAt lưu giờ UTC: lùi 7 tiếng để khớp ngày VN.
    const tzStart = new Date(start.getTime() - 7 * 3_600_000);
    const tzEnd = new Date(end.getTime() - 7 * 3_600_000);

    const and: Prisma.MediaTaskWhereInput[] = [
      this.media.taskScope(user),
      { type: 'video' },
      {
        OR: [
          { workDate: { gte: start, lt: end } },
          { workDate: null, createdAt: { gte: tzStart, lt: tzEnd } },
        ],
      },
    ];
    if (query.person_id) {
      and.push({
        OR: [{ assigneeId: query.person_id }, { editorId: query.person_id }],
      });
    }
    if (query.group_id) and.push({ contentGroupId: query.group_id });
    if (query.open === '1') {
      and.push({
        OR: [
          { status: { not: 'done' } },
          { publications: { none: { status: 'published' } } },
        ],
      });
    }
    const rows = await this.prisma.mediaTask.findMany({
      where: { AND: and },
      include: VIDEO_INCLUDE,
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    const people = await this.media.people(
      rows.flatMap((r) => [r.assigneeId, r.editorId]),
    );
    const assign = this.media.canAssign(user);
    return {
      month,
      rows: rows.map((r) => this.mapRow(r, people, user, assign)),
    };
  }

  private mapRow(
    r: VideoRow,
    people: Awaited<ReturnType<MediaService['people']>>,
    user: AuthenticatedUser,
    assign: boolean,
  ) {
    const pub = r.publications[0];
    return {
      id: r.id,
      code: mediaCode(r.code),
      title: r.title,
      work_date: vnDateOnly(r.workDate ?? r.createdAt),
      group: r.contentGroup
        ? {
            id: r.contentGroup.id,
            name: r.contentGroup.name,
            color_key: r.contentGroup.colorKey,
          }
        : null,
      shooter: r.assigneeId ? (people.get(r.assigneeId) ?? null) : null,
      editor: r.editorId ? (people.get(r.editorId) ?? null) : null,
      raw_link: r.rawLink,
      done_link: r.doneLink,
      status: r.status,
      note: r.description,
      channel: pub?.channelRecord
        ? {
            id: pub.channelRecord.id,
            name: pub.channelRecord.name,
            color_key: pub.channelRecord.colorKey,
            platform: pub.channelRecord.platform,
          }
        : null,
      posted: pub?.status === 'published',
      post_date:
        pub?.status === 'published' ? vnDateOnly(pub.scheduledDate) : null,
      can_edit:
        assign ||
        this.media.isParticipant(r, user) ||
        r.createdById === user.id,
    };
  }

  // ============================================================ thêm / sửa
  async create(dto: MediaVideoDto, user: AuthenticatedUser) {
    const assign = this.media.canAssign(user);
    // Không có quyền giao việc: chỉ ghi video của chính mình (mặc định mình là người quay).
    const shooterId = dto.shooter_id === undefined ? user.id : dto.shooter_id;
    if (!assign && shooterId !== user.id && dto.editor_id !== user.id) {
      throw new ForbiddenException(
        'Bạn chỉ thêm được video mình quay hoặc mình dựng',
      );
    }
    const workDate =
      dateOrNull(dto.work_date) ?? new Date(vnDateOnly(new Date()));
    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.mediaTask.create({
        data: {
          title: dto.title?.trim() || `Video ${dayLabel(workDate)}`,
          type: 'video',
          workDate,
          contentGroupId: dto.content_group_id ?? null,
          assigneeId: shooterId ?? null,
          editorId: dto.editor_id ?? null,
          rawLink: linkOrNull(dto.raw_link),
          doneLink: linkOrNull(dto.done_link),
          description: dto.note?.trim() || null,
          createdById: user.id,
        },
      });
      await tx.mediaTaskActivity.create({
        data: {
          taskId: task.id,
          accountId: user.id,
          kind: 'created',
          content: 'Thêm vào Sổ video',
        },
      });
      return task;
    });
    if (
      dto.status ||
      dto.channel_id ||
      dto.posted !== undefined ||
      dto.post_date
    ) {
      await this.update(
        created.id,
        {
          status: dto.status,
          channel_id: dto.channel_id,
          posted: dto.posted,
          post_date: dto.post_date,
        },
        user,
        true,
      );
    }
    await this.media.notify(
      [shooterId, dto.editor_id],
      `Bạn có video mới trong Sổ video ${mediaCode(created.code)}`,
      user,
      created.id,
    );
    return this.getRow(created.id, user);
  }

  async update(
    id: string,
    dto: MediaVideoDto,
    user: AuthenticatedUser,
    skipNotify = false,
  ) {
    const task = await this.prisma.mediaTask.findFirst({
      where: { AND: [{ id }, this.media.taskScope(user)] },
      include: VIDEO_INCLUDE,
    });
    if (!task) throw new NotFoundException('Không tìm thấy video');
    const assign = this.media.canAssign(user);
    if (
      !assign &&
      !this.media.isParticipant(task, user) &&
      task.createdById !== user.id
    ) {
      throw new ForbiddenException('Bạn không tham gia video này');
    }

    const data: Prisma.MediaTaskUncheckedUpdateInput = {};
    const log: string[] = [];
    if (dto.title !== undefined) data.title = dto.title?.trim() || task.title;
    if (dto.work_date !== undefined) data.workDate = dateOrNull(dto.work_date);
    if (dto.content_group_id !== undefined)
      data.contentGroupId = dto.content_group_id;
    if (dto.shooter_id !== undefined) data.assigneeId = dto.shooter_id;
    if (dto.editor_id !== undefined) data.editorId = dto.editor_id;
    if (dto.raw_link !== undefined) data.rawLink = linkOrNull(dto.raw_link);
    if (dto.done_link !== undefined) {
      data.doneLink = linkOrNull(dto.done_link);
      if (data.doneLink && data.doneLink !== task.doneLink)
        log.push('Cập nhật link video xong');
    }
    if (dto.note !== undefined) data.description = dto.note?.trim() || null;

    if (dto.status && dto.status !== task.status) {
      // Việc đang nằm trong luồng duyệt: chỉ người giao việc kéo ra khỏi luồng.
      if (['in_review', 'revision'].includes(task.status) && !assign) {
        throw new BadRequestException(
          'Video đang trong bước duyệt — chờ người duyệt xử lý',
        );
      }
      const doneLink =
        data.doneLink !== undefined ? data.doneLink : task.doneLink;
      if (dto.status === 'done' && !doneLink) {
        throw new BadRequestException(
          'Dán link video xong trước khi chuyển sang Xong',
        );
      }
      data.status = dto.status;
      data.completedAt = dto.status === 'done' ? new Date() : null;
      data.progress =
        dto.status === 'done'
          ? 100
          : dto.status === 'in_progress'
            ? Math.max(task.progress, 10)
            : 0;
      log.push(`${STATUS_TEXT[task.status]} → ${STATUS_TEXT[dto.status]}`);
    }

    const pubChange =
      dto.channel_id !== undefined ||
      dto.posted !== undefined ||
      dto.post_date !== undefined;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.mediaTask.update({ where: { id }, data });
      }
      if (pubChange) {
        await this.upsertPublication(
          tx,
          task,
          dto,
          user,
          (data.doneLink as string | null | undefined) ?? task.doneLink,
        );
        if (
          dto.posted !== undefined &&
          dto.posted !== (task.publications[0]?.status === 'published')
        ) {
          log.push(dto.posted ? 'Đã đăng' : 'Bỏ đánh dấu đã đăng');
        }
      }
      for (const content of log) {
        await tx.mediaTaskActivity.create({
          data: { taskId: id, accountId: user.id, kind: 'status', content },
        });
      }
    });

    if (!skipNotify && dto.editor_id && dto.editor_id !== task.editorId) {
      await this.media.notify(
        [dto.editor_id],
        `Bạn được giao dựng video ${mediaCode(task.code)}`,
        user,
        id,
      );
    }
    return this.getRow(id, user);
  }

  private async upsertPublication(
    tx: Prisma.TransactionClient,
    task: VideoRow,
    dto: MediaVideoDto,
    user: AuthenticatedUser,
    doneLink: string | null,
  ) {
    const pub = task.publications[0];
    let channel: { id: string; name: string; platform: string } | null =
      pub?.channelRecord ?? null;
    if (dto.channel_id !== undefined) {
      channel = dto.channel_id
        ? await tx.mediaChannel.findUnique({
            where: { id: dto.channel_id },
            select: { id: true, name: true, platform: true },
          })
        : null;
      if (dto.channel_id && !channel)
        throw new BadRequestException('Không tìm thấy kênh');
    }
    const posted = dto.posted ?? pub?.status === 'published';
    const postDate =
      dateOrNull(dto.post_date) ??
      (posted && pub?.status === 'published'
        ? pub.scheduledDate
        : new Date(vnDateOnly(new Date())));
    const data = {
      channelId: channel?.id ?? null,
      channel: channel?.name ?? null,
      platform: channel?.platform ?? pub?.platform ?? 'tiktok',
      status: posted ? 'published' : 'pending',
      scheduledDate: postDate,
      publishedAt: posted ? (pub?.publishedAt ?? new Date()) : null,
      link: pub?.link ?? (posted ? doneLink : null),
    };
    if (pub) {
      if (!channel && !posted) {
        // Bỏ kênh + chưa đăng + chưa có số liệu → xoá bài đăng rỗng.
        const hasMetrics =
          pub.views + pub.inbox + pub.candidates + pub.hired > 0;
        if (!hasMetrics && !pub.link) {
          await tx.mediaPublication.delete({ where: { id: pub.id } });
          return;
        }
      }
      await tx.mediaPublication.update({ where: { id: pub.id }, data });
    } else if (channel || posted) {
      await tx.mediaPublication.create({
        data: {
          ...data,
          title: task.title,
          taskId: task.id,
          campaignId: task.campaignId,
          companyId: task.companyId,
          factory: task.factory,
          publisherId: user.id,
          createdById: user.id,
        },
      });
    }
  }

  private async getRow(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.mediaTask.findUnique({
      where: { id },
      include: VIDEO_INCLUDE,
    });
    if (!row) throw new NotFoundException('Không tìm thấy video');
    const people = await this.media.people([row.assigneeId, row.editorId]);
    return this.mapRow(row, people, user, this.media.canAssign(user));
  }

  async remove(id: string, user: AuthenticatedUser) {
    const task = await this.prisma.mediaTask.findFirst({
      where: { AND: [{ id }, this.media.taskScope(user)] },
      select: { id: true, createdById: true },
    });
    if (!task) throw new NotFoundException('Không tìm thấy video');
    if (!this.media.canAssign(user) && task.createdById !== user.id) {
      throw new ForbiddenException(
        'Chỉ người thêm dòng hoặc người giao việc xoá được',
      );
    }
    await this.prisma.$transaction([
      this.prisma.mediaPublication.deleteMany({
        where: {
          taskId: id,
          link: null,
          views: 0,
          inbox: 0,
          candidates: 0,
          hired: 0,
        },
      }),
      this.prisma.mediaTask.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  // ============================================================ thống kê
  /** Theo người (quay / dựng xong / đã đăng) và theo kênh, trong khoảng ngày ghi sổ. */
  async stats(user: AuthenticatedUser, from?: string, to?: string) {
    const all = can(user, 'media.view_report');
    const start =
      dateOrNull(from) ?? new Date(`${vnDateOnly(new Date()).slice(0, 7)}-01`);
    const endIncl = dateOrNull(to) ?? new Date(vnDateOnly(new Date()));
    const end = new Date(endIncl.getTime() + 86_400_000);
    const tasks = await this.prisma.mediaTask.findMany({
      where: {
        type: 'video',
        ...(all
          ? {}
          : { OR: [{ assigneeId: user.id }, { editorId: user.id }] }),
        AND: [
          {
            OR: [
              { workDate: { gte: start, lt: end } },
              {
                workDate: null,
                createdAt: {
                  gte: new Date(start.getTime() - 7 * 3_600_000),
                  lt: new Date(end.getTime() - 7 * 3_600_000),
                },
              },
            ],
          },
        ],
      },
      select: {
        assigneeId: true,
        editorId: true,
        status: true,
        publications: {
          select: {
            status: true,
            channelId: true,
            views: true,
            inbox: true,
            candidates: true,
            hired: true,
          },
        },
      },
    });
    const byPerson = new Map<
      string,
      { shot: number; edited: number; posted: number }
    >();
    const bump = (id: string | null, key: 'shot' | 'edited' | 'posted') => {
      if (!id) return;
      const row = byPerson.get(id) ?? { shot: 0, edited: 0, posted: 0 };
      row[key]++;
      byPerson.set(id, row);
    };
    const byChannel = new Map<
      string,
      {
        videos: number;
        posted: number;
        views: number;
        inbox: number;
        candidates: number;
        hired: number;
      }
    >();
    for (const t of tasks) {
      bump(t.assigneeId, 'shot');
      if (t.status === 'done') bump(t.editorId ?? t.assigneeId, 'edited');
      const published = t.publications.some((p) => p.status === 'published');
      if (published) bump(t.assigneeId, 'posted');
      for (const p of t.publications) {
        const key = p.channelId ?? '';
        const row = byChannel.get(key) ?? {
          videos: 0,
          posted: 0,
          views: 0,
          inbox: 0,
          candidates: 0,
          hired: 0,
        };
        row.videos++;
        if (p.status === 'published') row.posted++;
        row.views += p.views;
        row.inbox += p.inbox;
        row.candidates += p.candidates;
        row.hired += p.hired;
        byChannel.set(key, row);
      }
    }
    const [people, channels] = await Promise.all([
      this.media.people([...byPerson.keys()]),
      this.prisma.mediaChannel.findMany({
        where: { id: { in: [...byChannel.keys()].filter(Boolean) } },
        select: { id: true, name: true, colorKey: true, platform: true },
      }),
    ]);
    const channelMap = new Map(channels.map((c) => [c.id, c]));
    return {
      total: {
        videos: tasks.length,
        done: tasks.filter((t) => t.status === 'done').length,
        posted: tasks.filter((t) =>
          t.publications.some((p) => p.status === 'published'),
        ).length,
      },
      by_person: [...byPerson.entries()]
        .map(([id, v]) => ({
          person: people.get(id) ?? {
            id,
            name: '—',
            avatar_url: null,
            role: '',
          },
          ...v,
        }))
        .sort((a, b) => b.shot + b.edited - (a.shot + a.edited)),
      by_channel: [...byChannel.entries()]
        .map(([id, v]) => {
          const c = channelMap.get(id);
          return {
            channel: c
              ? {
                  id: c.id,
                  name: c.name,
                  color_key: c.colorKey,
                  platform: c.platform,
                }
              : null,
            ...v,
          };
        })
        .sort((a, b) => b.posted - a.posted || b.views - a.views),
    };
  }
}

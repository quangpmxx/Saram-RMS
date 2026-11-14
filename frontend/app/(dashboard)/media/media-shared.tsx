"use client";

import type { ReactNode } from "react";
import { Camera, CirclePlay, Globe, MessageCircle, Music2, ThumbsUp, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ kiểu dữ liệu (khớp backend/src/media) */
export type TaskStatus = "todo" | "in_progress" | "in_review" | "revision" | "done";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

export interface MediaOptions {
  staff: Person[];
  companies: { id: string; name: string }[];
  campaigns: { id: string; name: string; active: boolean }[];
  plans: { id: string; title: string }[];
  me: {
    id: string;
    can_assign: boolean;
    can_review: boolean;
    can_manage_plan: boolean;
    can_manage_publish: boolean;
    can_view_report: boolean;
  };
}

export interface MediaTask {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: TaskStatus;
  priority: Priority;
  deadline: string | null;
  overdue: boolean;
  progress: number;
  platform: string | null;
  plan: { id: string; title: string } | null;
  campaign: { id: string; name: string } | null;
  idea: { id: string; title: string } | null;
  company_id: string | null;
  company_name: string | null;
  factory: string | null;
  assignee: Person | null;
  editor: Person | null;
  raw_link: string | null;
  done_link: string | null;
  members: Person[];
  created_by: Person | null;
  latest_submission: { version: number; review_status: string; submitted_at: string } | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  version: number;
  link: string | null;
  file_name: string | null;
  has_file: boolean;
  note: string | null;
  submitted_by: Person | null;
  submitted_at: string;
  review_status: string;
  review_note: string | null;
  reviewed_by: Person | null;
  reviewed_at: string | null;
}

export interface MediaTaskDetail extends MediaTask {
  activities: { id: string; kind: string; content: string; created_at: string; account: Person | null }[];
  submissions: Submission[];
  can: { edit: boolean; work: boolean; review: boolean };
}

/* ------------------------------------------------------------------ nhãn + màu */
export const STATUS_META: Record<TaskStatus, { label: string; dot: string; chip: string; column: string }> = {
  todo: { label: "Chờ thực hiện", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700 ring-slate-300/60", column: "from-slate-400 to-slate-500" },
  in_progress: { label: "Đang thực hiện", dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 ring-sky-300/60", column: "from-sky-400 to-blue-600" },
  in_review: { label: "Chờ duyệt", dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700 ring-violet-300/60", column: "from-violet-500 to-fuchsia-500" },
  revision: { label: "Cần chỉnh sửa", dot: "bg-orange-500", chip: "bg-orange-50 text-orange-700 ring-orange-300/60", column: "from-orange-400 to-pink-500" },
  done: { label: "Hoàn thành", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-300/60", column: "from-emerald-400 to-teal-500" },
};
export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "in_review", "revision", "done"];

export const PRIORITY_META: Record<Priority, { label: string; chip: string }> = {
  low: { label: "Thấp", chip: "bg-slate-100 text-slate-600" },
  normal: { label: "Bình thường", chip: "bg-blue-50 text-blue-700" },
  high: { label: "Cao", chip: "bg-amber-50 text-amber-700" },
  urgent: { label: "Gấp", chip: "bg-rose-50 text-rose-700" },
};

export const TYPE_LABEL: Record<string, string> = {
  video: "Video",
  post: "Bài viết",
  livestream: "Livestream",
  design: "Thiết kế",
  other: "Khác",
};
export const TYPE_EMOJI: Record<string, string> = { video: "🎬", post: "📝", livestream: "🔴", design: "🎨", other: "✨" };

export const PLATFORMS = ["tiktok", "facebook", "youtube", "zalo", "instagram", "other"] as const;
export const PLATFORM_META: Record<string, { label: string; icon: LucideIcon; chip: string }> = {
  tiktok: { label: "TikTok", icon: Music2, chip: "bg-slate-900 text-white" },
  facebook: { label: "Facebook", icon: ThumbsUp, chip: "bg-blue-600 text-white" },
  youtube: { label: "YouTube", icon: CirclePlay, chip: "bg-red-600 text-white" },
  zalo: { label: "Zalo", icon: MessageCircle, chip: "bg-sky-500 text-white" },
  instagram: { label: "Instagram", icon: Camera, chip: "bg-gradient-to-r from-fuchsia-500 to-orange-400 text-white" },
  other: { label: "Khác", icon: Globe, chip: "bg-slate-500 text-white" },
};

export const IDEA_STATUS: Record<string, { label: string; chip: string }> = {
  new: { label: "Mới", chip: "bg-sky-50 text-sky-700" },
  approved: { label: "Đã chốt", chip: "bg-violet-50 text-violet-700" },
  used: { label: "Đã dùng", chip: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Lưu trữ", chip: "bg-slate-100 text-slate-500" },
};

export const REVIEW_META: Record<string, { label: string; chip: string }> = {
  pending: { label: "Chờ duyệt", chip: "bg-violet-50 text-violet-700" },
  approved: { label: "Đã duyệt", chip: "bg-emerald-50 text-emerald-700" },
  revision: { label: "Cần chỉnh sửa", chip: "bg-orange-50 text-orange-700" },
  superseded: { label: "Đã thay bản mới", chip: "bg-slate-100 text-slate-500" },
};

/* ------------------------------------------------------------------ thành phần nhỏ */
export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", m.chip, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", className)}>{children}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return <Chip className={m.chip}>{priority === "urgent" ? "🔥 " : ""}{m.label}</Chip>;
}

export function PlatformChip({ platform }: { platform: string | null }) {
  if (!platform) return null;
  const m = PLATFORM_META[platform] ?? PLATFORM_META.other;
  const Icon = m.icon;
  return (
    <Chip className={m.chip}>
      <Icon className="size-3" />
      {m.label}
    </Chip>
  );
}

export function PersonChip({ person, size = "sm" }: { person: Person | null; size?: "sm" | "xs" }) {
  if (!person) return <span className="text-xs text-slate-400">Chưa giao</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar fullName={person.name} avatarUrl={person.avatar_url} className={size === "xs" ? "h-5! w-5! text-[9px]!" : "h-6! w-6! text-[10px]!"} />
      <span className="truncate text-xs font-medium text-slate-700">{person.name}</span>
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="flex -space-x-1.5">
      {shown.map((p) => (
        <span key={p.id} title={p.name} className="rounded-full ring-2 ring-white">
          <Avatar fullName={p.name} avatarUrl={p.avatar_url} className="h-6! w-6! text-[10px]!" />
        </span>
      ))}
      {people.length > max && (
        <span className="grid size-6 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 ring-2 ring-white">+{people.length - max}</span>
      )}
    </span>
  );
}

/** Thanh tiến độ gradient. */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Khung "thẻ" bo tròn, hover nhẹ — nhận diện riêng của Media. */
export function StudioCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-violet-500/5 transition-shadow duration-200 hover:shadow-md hover:shadow-violet-500/10", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ định dạng */
export function fmtNumber(n: number): string {
  return n.toLocaleString("vi-VN");
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export function fmtDeadline(value: string | null): string {
  if (!value) return "Không hạn";
  const d = new Date(value);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Còn bao lâu tới hạn — "còn 2 ngày", "quá 3 giờ". */
export function relativeDeadline(value: string | null): { text: string; tone: "late" | "soon" | "ok" } | null {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3_600_000);
  const text = hours < 24 ? `${hours} giờ` : `${Math.round(hours / 24)} ngày`;
  if (diff < 0) return { text: `Quá ${text}`, tone: "late" };
  return { text: `Còn ${text}`, tone: diff < 48 * 3_600_000 ? "soon" : "ok" };
}

/** YYYY-MM-DD theo giờ máy (VN). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Chuỗi datetime-local từ ISO. */
export function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return `${ymd(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

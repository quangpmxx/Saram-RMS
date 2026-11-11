"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ClipboardList, Copy, Pencil, Plus } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { RecruitmentKind, RecruitmentPosting, RecruitmentStatus, RecruitmentTeamScope } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/form";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { formatDMYHM } from "@/lib/date-format";
import { cn } from "@/lib/cn";
import { RecruitmentFormModal } from "./recruitment-form-modal";
import {
  collectTags,
  STATUS_META,
  TAG_LABEL,
  type WorkerFilter,
  ageLabel,
  buildZaloMessage,
  formatDong,
  formatMillions,
  genderLabel,
  lines,
  mismatchReason,
  resolveBirthYear,
  totalPay,
} from "./recruitment-shared";

const NO_AREA = "Chưa rõ khu vực";
/** Giá trị ô chọn nhóm cho các thẻ chưa gán nhóm (dữ liệu nhập sẵn từ sheet). */
const NO_TEAM = "__none__";
const EMPTY_FILTER: WorkerFilter = { gender: "", birthYear: "", wants: [] };

const chipClass = (active: boolean) =>
  cn(
    "rounded-full border px-2 py-px text-[11px] leading-5 font-medium transition-colors",
    active ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
  );
const labelClass = "text-[11px] font-semibold tracking-wide text-slate-500 uppercase";

/**
 * Lịch tuyển dụng (2026-11-11, yêu cầu người dùng: "vừa gọi điện vừa nhìn vào
 * tư vấn dễ nhất"). Trên: lọc theo lao động đang tư vấn (giới tính, năm sinh,
 * mong muốn). Trái: công ty gom theo khu vực, công ty không nhận được lao động
 * đó bị đẩy xuống cuối kèm lý do. Phải: "tờ tư vấn" ghim cố định của công ty
 * đang chọn. Phím ↑/↓ chuyển công ty không cần chuột.
 */
export function RecruitmentScheduleClient({
  canEdit,
  initialPostings,
  scope,
}: {
  canEdit: boolean;
  initialPostings: RecruitmentPosting[];
  /** Mỗi nhóm một lịch riêng: `can_see_all` (Admin, Quản lý chưa được chọn nhóm) mới có ô chọn nhóm. */
  scope: RecruitmentTeamScope;
}) {
  useSetPageTitle("Lịch tuyển dụng");
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const year = new Date(now).getFullYear();

  const [postings, setPostings] = useState(initialPostings);
  const canSeeAll = scope.can_see_all;
  // Nhóm đang xem (chỉ dùng khi thấy mọi nhóm): ưu tiên nhóm đầu tiên đã có lịch; chưa nhóm nào có thì mở phần chưa gán nhóm.
  const [teamFilter, setTeamFilter] = useState(
    () =>
      scope.teams.find((t) => initialPostings.some((p) => p.team_id === t.id))?.id ??
      (initialPostings.some((p) => !p.team_id) ? NO_TEAM : (scope.teams[0]?.id ?? NO_TEAM)),
  );
  const [assignTeamId, setAssignTeamId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [kind, setKind] = useState<RecruitmentKind>("official");
  const [filter, setFilter] = useState<WorkerFilter>(EMPTY_FILTER);
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  const [showPaused, setShowPaused] = useState(false);
  const [wantsOpen, setWantsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** undefined = đóng; null = thêm mới; có giá trị = sửa thẻ đó. */
  const [editing, setEditing] = useState<RecruitmentPosting | null | undefined>(undefined);

  const unassignedCount = postings.filter((p) => !p.team_id).length;
  const inTeam = useMemo(
    () => (canSeeAll ? postings.filter((p) => (p.team_id ?? NO_TEAM) === teamFilter) : postings),
    [postings, canSeeAll, teamFilter],
  );
  const inKind = useMemo(() => inTeam.filter((p) => p.kind === kind), [inTeam, kind]);
  const pausedCount = inKind.filter((p) => p.status === "paused").length;
  const areas = useMemo(
    () => [...new Set(inKind.filter((p) => showPaused || p.status !== "paused").map((p) => p.area ?? NO_AREA))],
    [inKind, showPaused],
  );
  const allAreas = useMemo(() => [...new Set(inTeam.map((p) => p.area).filter((a): a is string => !!a))].sort(), [inTeam]);
  const tagOptions = useMemo(() => collectTags(inTeam), [inTeam]);
  // Năm sinh gõ dở/không hợp lệ thì coi như chưa lọc theo tuổi — không báo "vào được" bừa.
  const birthYear = resolveBirthYear(filter.birthYear, year);
  const workerAge = birthYear != null ? year - birthYear : null;
  const isFiltering = filter.gender !== "" || birthYear != null || filter.wants.length > 0;

  const { matched, mismatched } = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const visible = inKind.filter(
      (p) =>
        (showPaused || p.status !== "paused") &&
        (area === "" || (p.area ?? NO_AREA) === area) &&
        (keyword === "" || `${p.company_name} ${p.work ?? ""}`.toLowerCase().includes(keyword)),
    );
    const ok: RecruitmentPosting[] = [];
    const no: { posting: RecruitmentPosting; reason: string }[] = [];
    for (const posting of visible) {
      const reason = mismatchReason(posting, filter, year);
      if (reason) no.push({ posting, reason });
      else ok.push(posting);
    }
    return { matched: ok, mismatched: no };
  }, [inKind, showPaused, area, search, filter, year]);

  const orderedIds = useMemo(() => {
    const groups = [...new Set(matched.map((p) => p.area ?? NO_AREA))];
    return [
      ...groups.flatMap((group) => matched.filter((p) => (p.area ?? NO_AREA) === group).map((p) => p.id)),
      ...mismatched.map((m) => m.posting.id),
    ];
  }, [matched, mismatched]);

  const activeId = selectedId && orderedIds.includes(selectedId) ? selectedId : (orderedIds[0] ?? null);
  const selected = postings.find((p) => p.id === activeId) ?? null;

  // Phím ↑/↓: chuyển công ty khi đang cầm điện thoại, không cần rê chuột.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (editing !== undefined) return;
      const target = event.target as HTMLElement | null;
      if (target && ["TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (orderedIds.length === 0) return;
      const current = activeId ? orderedIds.indexOf(activeId) : -1;
      const next = Math.max(0, Math.min(orderedIds.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
      event.preventDefault();
      setSelectedId(orderedIds[next]);
      document.getElementById(`recruitment-row-${orderedIds[next]}`)?.scrollIntoView({ block: "nearest" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [orderedIds, activeId, editing]);

  function selectRow(id: string) {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => document.getElementById("recruitment-sheet")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }

  function toggleWant(code: string) {
    setFilter((current) => ({
      ...current,
      wants: current.wants.includes(code) ? current.wants.filter((w) => w !== code) : [...current.wants, code],
    }));
  }

  function clearFilters() {
    setFilter(EMPTY_FILTER);
    setArea("");
    setSearch("");
  }

  async function changeStatus(posting: RecruitmentPosting, status: RecruitmentStatus) {
    try {
      const saved = await clientApi<RecruitmentPosting>(`/recruitment-schedule/${posting.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setPostings((current) => current.map((p) => (p.id === saved.id ? saved : p)));
      if (status === "paused") setShowPaused(true);
      toast.success(`${posting.company_name}: ${STATUS_META[status].label}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, không thể đổi trạng thái");
    }
  }

  /** Gán mọi thẻ chưa có nhóm (nhập sẵn từ sheet) cho 1 nhóm rồi chuyển sang xem nhóm đó. */
  async function assignAllToTeam() {
    const team = scope.teams.find((t) => t.id === assignTeamId);
    if (!team || isAssigning) return;
    if (!window.confirm(`Gán cả ${unassignedCount} công ty chưa có nhóm cho ${team.name}?`)) return;
    setIsAssigning(true);
    try {
      const result = await clientApi<{ moved: number }>("/recruitment-schedule/assign-team", {
        method: "POST",
        body: JSON.stringify({ team_id: team.id }),
      });
      setPostings(await clientApi<RecruitmentPosting[]>("/recruitment-schedule"));
      setTeamFilter(team.id);
      setAssignTeamId("");
      toast.success(`Đã gán ${result.moved} công ty cho ${team.name}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, không thể gán nhóm");
    } finally {
      setIsAssigning(false);
    }
  }

  async function copyMessage(posting: RecruitmentPosting) {
    try {
      // Có tin tự viết thì dùng tin đó; không thì phần mềm tự soạn.
      await navigator.clipboard.writeText(posting.zalo_message?.trim() || buildZaloMessage(posting, year));
      toast.success("Đã sao chép");
    } catch {
      toast.error("Trình duyệt chặn sao chép — hãy bôi đen và sao chép tay");
    }
  }


  function renderRow(posting: RecruitmentPosting, reason?: string) {
    const status = STATUS_META[posting.status];
    const isActive = posting.id === activeId;
    return (
      <button
        key={posting.id}
        id={`recruitment-row-${posting.id}`}
        type="button"
        aria-current={isActive}
        onClick={() => selectRow(posting.id)}
        className={cn(
          // Mọi dòng cao bằng nhau (đủ chỗ 2 dòng tên); tên dài hơn 2 dòng mới cắt "…" (rê chuột xem đủ tên).
          "block w-full border-b border-slate-200 px-3 py-1.5 text-left text-sm last:border-b-0 hover:bg-slate-50",
          isActive && "bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand-600)] hover:bg-brand-50",
          (reason || posting.status === "paused") && "opacity-60",
        )}
      >
        <span className="flex h-10 items-center gap-2">
          <span className="line-clamp-2 min-w-0 flex-1 leading-5 font-semibold break-words text-slate-900" title={posting.company_name}>
            {posting.company_name}
          </span>
          <Badge variant={status.variant} className="w-[4.75rem] shrink-0 justify-center px-0 py-0 text-[11px]">
            {status.label}
          </Badge>
        </span>
        {reason && (
          <span className="block truncate text-xs font-semibold text-red-600" title={reason}>
            {reason}
          </span>
        )}
      </button>
    );
  }

  const matchedGroups = [...new Set(matched.map((p) => p.area ?? NO_AREA))];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
          {(["official", "seasonal"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setArea("");
              }}
              className={cn(
                "rounded-md px-3.5 py-1 text-sm font-semibold transition-colors",
                // Yêu cầu người dùng: Chính thức nền xanh, Thời vụ nền đỏ hồng (đang chọn = đậm, chưa chọn = chữ màu nhạt).
                value === "official"
                  ? kind === value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-brand-700 hover:bg-brand-100"
                  : kind === value
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-rose-600 hover:bg-rose-100",
              )}
            >
              {value === "official" ? "Chính thức" : "Thời vụ"}
            </button>
          ))}
        </div>
        {canSeeAll ? (
          <div className="w-44 shrink-0">
            <Select
              uiSize="xs"
              aria-label="Lịch tuyển của nhóm"
              value={teamFilter}
              onChange={(event) => {
                setTeamFilter(event.target.value);
                setArea("");
              }}
            >
              {scope.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
              {(unassignedCount > 0 || teamFilter === NO_TEAM) && <option value={NO_TEAM}>Chưa gán nhóm ({unassignedCount})</option>}
            </Select>
          </div>
        ) : (
          scope.teams[0] && <span className="text-xs font-semibold text-slate-700">{scope.teams[0].name}</span>
        )}
        <span className="text-xs text-slate-500">
          {matched.length} / {matched.length + mismatched.length} công ty phù hợp
        </span>
        {pausedCount > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showPaused} onChange={(event) => setShowPaused(event.target.checked)} />
            Hiện cả {pausedCount} công ty tạm dừng
          </label>
        )}
        {canEdit && (
          <Button type="button" size="xs" className="ml-auto" onClick={() => setEditing(null)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Thêm công ty
          </Button>
        )}
      </div>

      {!canSeeAll && scope.teams.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Tài khoản của bạn chưa thuộc nhóm nào nên chưa có lịch tuyển để xem. Nhờ Admin xếp nhóm hoặc chọn “Lịch tuyển dụng của nhóm” trong Quản lý tài khoản.
        </p>
      )}
      {canSeeAll && canEdit && teamFilter === NO_TEAM && unassignedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="font-semibold">{unassignedCount} công ty chưa gán nhóm</span>
          <span>— Sale và Leader chưa nhìn thấy. Gán tất cả cho nhóm:</span>
          <div className="w-40">
            <Select uiSize="xs" aria-label="Nhóm nhận lịch tuyển" value={assignTeamId} onChange={(event) => setAssignTeamId(event.target.value)}>
              <option value="">— Chọn nhóm —</option>
              {scope.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" size="xs" disabled={!assignTeamId || isAssigning} onClick={() => void assignAllToTeam()}>
            {isAssigning ? "Đang gán..." : "Gán tất cả"}
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
        {/* Input dùng chung có sẵn w-full (cn không gộp class) → bọc div để giới hạn bề rộng, giữ cả hàng trên 1 dòng. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:flex-nowrap">
          <span className={cn(labelClass, "w-full shrink-0 sm:w-auto")}>Lao động</span>
          <div className="flex shrink-0 overflow-hidden rounded-md border border-slate-300">
            {(
              [
                ["", "Tất cả"],
                ["male", "Nam"],
                ["female", "Nữ"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter.gender === value}
                onClick={() => setFilter((current) => ({ ...current, gender: value }))}
                className={cn(
                  "border-r border-slate-300 px-2.5 py-0.5 text-xs font-semibold last:border-r-0",
                  filter.gender === value ? "bg-brand-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="w-20 shrink-0">
          <Input
            uiSize="xs"
            inputMode="numeric"
            aria-label="Năm sinh của lao động"
            placeholder="Năm sinh"
            className="font-semibold tabular-nums"
            value={filter.birthYear}
            onChange={(event) => setFilter((current) => ({ ...current, birthYear: event.target.value.replace(/\D/g, "").slice(0, 4) }))}
          />
          </div>
          {workerAge != null ? (
            <span className="shrink-0 text-xs font-semibold text-brand-700">
              sinh {birthYear}, {workerAge} tuổi
            </span>
          ) : (
            filter.birthYear !== "" && <span className="shrink-0 text-xs font-semibold text-red-600">Năm sinh chưa đúng</span>
          )}
          <div className="w-36 shrink-0">
            <Select uiSize="xs" aria-label="Khu vực" value={area} onChange={(event) => setArea(event.target.value)}>
              <option value="">Mọi khu vực</option>
              {areas.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              aria-expanded={wantsOpen}
              onClick={() => setWantsOpen((open) => !open)}
              className={cn(
                "flex max-w-56 items-center gap-1 rounded-lg border px-2 py-1 text-xs shadow-sm",
                filter.wants.length > 0 ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="truncate">
                {filter.wants.length === 0 ? "Lao động muốn…" : filter.wants.map((w) => TAG_LABEL[w] ?? w).join(", ")}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            </button>
            {wantsOpen && (
              <>
                {/* Lớp nền trong suốt: bấm ra ngoài để đóng. z thấp hơn header (z-50). */}
                <div className="fixed inset-0 z-30" onClick={() => setWantsOpen(false)} />
                <div className="absolute top-full left-0 z-40 mt-1 flex w-64 flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  {tagOptions.map((tag) => (
                    <button
                      key={tag.code}
                      type="button"
                      aria-pressed={filter.wants.includes(tag.code)}
                      onClick={() => toggleWant(tag.code)}
                      className={chipClass(filter.wants.includes(tag.code))}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <Input
              uiSize="xs"
              type="search"
              aria-label="Tìm công ty"
              placeholder="Tìm tên công ty, công việc…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {(isFiltering || area !== "" || search !== "") && (
            <button type="button" onClick={clearFilters} className="ml-auto text-xs font-semibold text-accent-600 hover:underline">
              Xoá lọc
            </button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          {matchedGroups.map((group) => (
            <section key={group}>
              <h2 className={cn(labelClass, "mb-1")}>{group}</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {matched.filter((p) => (p.area ?? NO_AREA) === group).map((p) => renderRow(p))}
              </div>
            </section>
          ))}
          {matched.length === 0 && (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" strokeWidth={1.75} />}
              title={inKind.length === 0 ? "Chưa có công ty nào" : "Không có công ty nào phù hợp"}
              description={
                inKind.length === 0
                  ? "Bấm “Thêm công ty” để nhập lịch tuyển đầu tiên."
                  : "Thử bỏ bớt điều kiện lọc, hoặc bật “Hiện cả công ty tạm dừng”."
              }
            />
          )}
          {mismatched.length > 0 && (
            <section>
              <h2 className={cn(labelClass, "mb-1")}>Không phù hợp ({mismatched.length})</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {mismatched.map((m) => renderRow(m.posting, m.reason))}
              </div>
            </section>
          )}
        </div>

        <aside
          id="recruitment-sheet"
          className="min-w-0 scroll-mt-16 overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-14 lg:max-h-[calc(100vh-4.5rem)] lg:overflow-y-auto"
        >
          {selected ? (
            <AdviceSheet
              posting={selected}
              year={year}
              canEdit={canEdit}
              verdict={isFiltering ? mismatchReason(selected, filter, year) : null}
              workerAge={workerAge}
              onCopy={() => void copyMessage(selected)}
              onEdit={() => setEditing(selected)}
              onStatusChange={(status) => void changeStatus(selected, status)}
            />
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">Chọn một công ty bên trái để xem tờ tư vấn.</p>
          )}
        </aside>
      </div>

      {editing !== undefined && (
        <RecruitmentFormModal
          key={editing?.id ?? "new"}
          posting={editing}
          defaultKind={kind}
          teamOptions={canSeeAll ? scope.teams : null}
          defaultTeamId={teamFilter === NO_TEAM ? null : teamFilter}
          areaOptions={allAreas}
          tagOptions={tagOptions}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setPostings((current) =>
              current.some((p) => p.id === saved.id) ? current.map((p) => (p.id === saved.id ? saved : p)) : [...current, saved],
            );
            setKind(saved.kind);
            if (canSeeAll) setTeamFilter(saved.team_id ?? NO_TEAM);
            if (saved.status === "paused") setShowPaused(true);
            setSelectedId(saved.id);
            setEditing(undefined);
          }}
          onDeleted={(id) => {
            setPostings((current) => current.filter((p) => p.id !== id));
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}

function BulletList({ text }: { text: string | null }) {
  const items = lines(text);
  if (items.length === 0) return <p className="text-sm text-slate-400 italic">Chưa nhập</p>;
  return (
    <ul className="list-disc space-y-0.5 pl-4 text-[15px] text-slate-800">
      {items.map((item, index) => (
        <li key={index} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Một hàng mục trong tờ tư vấn: điện thoại xếp dọc, từ md chia cột, ngăn nhau bằng đường kẻ. */
const SHEET_ROW = "grid divide-y divide-slate-200 border-b border-slate-200 md:divide-x md:divide-y-0";

function Section({ title, tone, children }: { title: string; tone?: "pro" | "con"; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 px-4 py-3", tone === "pro" && "bg-emerald-50", tone === "con" && "bg-amber-50")}>
      <h3 className={cn(labelClass, "mb-1.5", tone === "pro" && "text-emerald-700", tone === "con" && "text-amber-700")}>{title}</h3>
      {children}
    </div>
  );
}

/** "Tờ tư vấn" — thứ tự mục theo đúng trình tự Sale hay nói khi gọi điện. */
function AdviceSheet({
  posting,
  year,
  canEdit,
  verdict,
  workerAge,
  onCopy,
  onEdit,
  onStatusChange,
}: {
  posting: RecruitmentPosting;
  year: number;
  canEdit: boolean;
  /** null = chưa lọc theo lao động; "" = nhận được; còn lại = lý do không nhận. */
  verdict: string | null;
  /** Tuổi lao động đang tư vấn (null = chưa nhập năm sinh). */
  workerAge: number | null;
  onCopy: () => void;
  onEdit: () => void;
  onStatusChange: (status: RecruitmentStatus) => void;
}) {
  const status = STATUS_META[posting.status];
  const total = totalPay(posting);
  const bonusSteps = lines(posting.bonus);
  const age = ageLabel(posting, year);

  return (
    <div>
      {/* Tên công ty và hàng nút luôn chung 1 dòng (từ sm): tên co lại/xuống dòng, nút không bị đẩy xuống. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-slate-200 px-4 py-3 sm:flex-nowrap">
        <div className="min-w-0 sm:flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-xl leading-tight font-bold text-slate-900">
            <span className="break-words">{posting.company_name}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {posting.area ?? NO_AREA} · {posting.kind === "official" ? "Chính thức" : "Thời vụ"} · cập nhật {formatDMYHM(posting.updated_at)} bởi{" "}
            {posting.updated_by_name}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <Button type="button" size="xs" onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
            Sao chép tin Zalo
          </Button>
          {canEdit && (
            <>
              <Select
                uiSize="xs"
                aria-label="Đổi trạng thái tuyển"
                style={{ width: "6.5rem", flexShrink: 0 }}
                value={posting.status}
                onChange={(event) => onStatusChange(event.target.value as RecruitmentStatus)}
              >
                {(Object.keys(STATUS_META) as RecruitmentStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {STATUS_META[value].label}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="outline" size="xs" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                Sửa
              </Button>
            </>
          )}
        </div>
      </div>

      {verdict !== null && (
        <p className={cn("border-b border-slate-200 px-4 py-2 text-sm font-semibold", verdict ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
          {verdict
            ? `Lao động này không vào được: ${verdict}`
            : workerAge == null
              ? "Lao động này vào được (chưa nhập năm sinh nên chưa xét tuổi)"
              : posting.age_min == null && posting.age_max == null
                ? `Lao động ${workerAge} tuổi: công ty này chưa nhập giới hạn tuổi, cần hỏi lại`
                : `Lao động ${workerAge} tuổi vào được (nhận ${posting.age_min ?? "?"} – ${posting.age_max ?? "?"} tuổi)`}
        </p>
      )}

      <div className="grid grid-cols-2 border-b border-slate-200 sm:grid-cols-4">
        <Fact label="Lương + phụ cấp" value={total != null ? formatMillions(total) : "Chưa nhập"} valueClass="text-brand-700">
          {posting.base_salary != null && (
            <>
              Cơ bản {formatDong(posting.base_salary)}
              {posting.allowance ? ` + phụ cấp ${formatDong(posting.allowance)}` : ""}
            </>
          )}
        </Fact>
        <Fact label="Thưởng" value={posting.bonus_summary ?? "—"} valueClass="text-accent-600" />
        <Fact label="Nhận" value={genderLabel(posting)} small>
          {age}
        </Fact>
        <Fact label="Lịch phỏng vấn" value={lines(posting.interview_slot).join(", ") || "Chưa nhập"} small />
      </div>

      {(posting.salary_note || bonusSteps.length > 0) && (
        <div className={cn(SHEET_ROW, posting.salary_note && bonusSteps.length > 0 && "md:grid-cols-2")}>
          {posting.salary_note && (
            <Section title="Chi tiết lương">
              <BulletList text={posting.salary_note} />
            </Section>
          )}
          {bonusSteps.length > 0 && (
            <Section title="Thưởng nhận từng mốc">
              <div className="flex flex-wrap gap-1">
                {bonusSteps.map((step, index) => {
                  const match = /^(.{1,16}?)\s*:\s*(.+)$/.exec(step);
                  return (
                    <div key={index} className="rounded-lg border border-accent-200 bg-accent-50 px-2.5 py-1">
                      {match ? (
                        <>
                          <div className="text-[11px] font-semibold text-slate-500">{match[1]}</div>
                          <div className="text-sm font-bold text-accent-700 tabular-nums">{match[2]}</div>
                        </>
                      ) : (
                        <div className="text-sm font-semibold text-accent-700">{step}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      )}

      <div className={cn(SHEET_ROW, "md:grid-cols-3")}>
        <Section title="Công việc">
          <BulletList text={posting.work} />
          {posting.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {posting.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {TAG_LABEL[tag] ?? tag}
                </span>
              ))}
            </div>
          )}
        </Section>
        <Section title="Hồ sơ, đi phỏng vấn mang gì">
          <BulletList text={posting.documents} />
          {posting.requirement && (
            <div className="mt-2">
              <p className={cn(labelClass, "mb-1")}>Yêu cầu</p>
              <BulletList text={posting.requirement} />
            </div>
          )}
        </Section>
        <Section title="Trọ gần, đi lại">
          <BulletList text={posting.housing} />
        </Section>
      </div>

      <div className={cn(SHEET_ROW, "border-b-0 md:grid-cols-3")}>
        <Section title="Ưu điểm" tone="pro">
          <BulletList text={posting.pros} />
        </Section>
        <Section title="Nhược điểm" tone="con">
          <BulletList text={posting.cons} />
        </Section>
        <Section title="Lưu ý">
          <BulletList text={posting.notes} />
        </Section>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  valueClass,
  small,
  children,
}: {
  label: string;
  value: string;
  valueClass?: string;
  small?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 border-r border-slate-200 px-4 py-2.5 even:border-r-0 sm:even:border-r sm:last:border-r-0">
      <div className={labelClass}>{label}</div>
      <div className={cn("mt-0.5 leading-snug font-bold break-words tabular-nums", small ? "text-[15px] text-slate-900" : "text-xl", valueClass)}>{value}</div>
      {children && <div className="mt-0.5 text-xs text-slate-500">{children}</div>}
    </div>
  );
}

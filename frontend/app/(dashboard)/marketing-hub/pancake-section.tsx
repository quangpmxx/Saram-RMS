"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

interface PancakePageItem {
  id: string;
  page_id: string;
  name: string;
  owner: { id: string; full_name: string };
  mkt_source: { id: string; name: string } | null;
  status: "connected" | "error" | "disconnected";
  synced: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  message_count: number;
  phone_count: number;
  phone_rate: number | null;
  lead_count: number;
}
type Option = { id: string; name: string };

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : "Có lỗi xảy ra";
const num = (n: number) => n.toLocaleString("vi-VN");

/**
 * Bảng Pancake theo page (theo kỳ đang lọc): người nhắn mới, số để lại SĐT, tỉ lệ, data đã up
 * tự động. Liên kết/gỡ: Admin hoặc MKT (page của mình); đổi phụ trách / Nguồn MKT: Admin.
 */
export function PancakeSection({
  from,
  to,
  isAdmin,
  canConfig,
  canConnect,
  canEditNote,
  userId,
  staff,
  mktSources,
}: {
  from: string;
  to: string;
  isAdmin: boolean;
  /** Gắn Nguồn MKT (quyền mkt.config). */
  canConfig: boolean;
  canConnect: boolean;
  /** Chọn bài + sửa "Ghi chú khi up số" theo bài (quyền Chỉnh sửa Marketing Hub). */
  canEditNote: boolean;
  userId: string;
  staff: { id: string; full_name: string }[];
  mktSources: Option[];
}) {
  const toast = useToast();
  const [items, setItems] = useState<PancakePageItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await clientApi<{ items: PancakePageItem[] }>(
        `/pancake/pages?${new URLSearchParams({ from, to })}`,
      );
      setItems(r.items);
    } catch (e) {
      toast.error(errorText(e));
    }
  }, [from, to, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function act(id: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  const patch = (id: string, path: string, body: object, okMsg: string) =>
    void act(
      id,
      () =>
        clientApi(`/pancake/pages/${id}/${path}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      okMsg,
    );

  const shown = items?.filter((i) => i.status !== "disconnected") ?? [];
  const total = shown.reduce(
    (s, i) => ({
      m: s.m + i.message_count,
      p: s.p + i.phone_count,
      l: s.l + i.lead_count,
    }),
    { m: 0, p: 0, l: 0 },
  );
  const td = "border border-slate-200 px-3 py-2";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Pancake theo page
        </h2>
        {canConnect && (
          <Button type="button" size="xs" onClick={() => setShowConnect(true)}>
            Liên kết Pancake
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
        <table className="w-full border-collapse text-sm [&_td]:text-center [&_th]:text-center">
          <thead className="bg-slate-700 text-xs font-semibold text-white">
            <tr>
              <th className={td}>Page</th>
              <th className={td}>Nhân viên phụ trách</th>
              <th className={td}>Nguồn MKT</th>
              <th className={td}>Người nhắn tin mới</th>
              <th className={td}>Để lại SĐT</th>
              <th className={td}>Tỉ lệ để lại SĐT</th>
              <th className={td}>Data đã up tự động</th>
              <th className={td}>Trạng thái</th>
              <th className={td} />
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => {
              const mine = isAdmin || i.owner.id === userId;
              const ownerOptions = [
                ...new Map<string, string>([
                  [i.owner.id, i.owner.full_name],
                  ...staff.map((s) => [s.id, s.full_name] as [string, string]),
                ]),
              ];
              return (
                <tr key={i.id}>
                  <td className={td}>{i.name}</td>
                  <td className={td}>
                    {isAdmin ? (
                      <Select
                        value={i.owner.id}
                        disabled={busyId === i.id}
                        onChange={(e) =>
                          patch(
                            i.id,
                            "owner",
                            { owner_id: e.target.value },
                            "Đã đổi nhân viên phụ trách",
                          )
                        }
                      >
                        {ownerOptions.map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      i.owner.full_name
                    )}
                  </td>
                  <td className={td}>
                    {canConfig ? (
                      <Select
                        value={i.mkt_source?.id ?? ""}
                        disabled={busyId === i.id}
                        onChange={(e) =>
                          patch(
                            i.id,
                            "mkt-source",
                            { mkt_source_id: e.target.value || null },
                            "Đã gắn nguồn MKT",
                          )
                        }
                      >
                        <option value="">— Chưa gắn —</option>
                        {mktSources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      (i.mkt_source?.name ?? (
                        <span className="text-xs text-amber-600">
                          Chưa gắn
                        </span>
                      ))
                    )}
                  </td>
                  <td className={td}>{i.synced ? num(i.message_count) : "—"}</td>
                  <td className={td}>{i.synced ? num(i.phone_count) : "—"}</td>
                  <td className={`${td} font-medium`}>
                    {i.phone_rate === null
                      ? "—"
                      : `${(i.phone_rate * 100).toFixed(1).replace(".", ",")}%`}
                  </td>
                  <td className={td}>{num(i.lead_count)}</td>
                  <td className={td}>
                    <span
                      className={
                        i.status === "connected"
                          ? "text-emerald-600"
                          : "text-red-600"
                      }
                    >
                      {i.status === "connected" ? "Đã kết nối" : "Lỗi kết nối"}
                    </span>
                    <div className="text-xs text-slate-400">
                      {i.synced
                        ? `Đọc lúc: ${new Date(i.last_sync_at!).toLocaleTimeString("vi-VN")}`
                        : "Đang lấy dữ liệu…"}
                    </div>
                    {i.last_error && (
                      <div className="text-xs text-red-500">{i.last_error}</div>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {mine && canConnect && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={busyId === i.id}
                        onClick={() => {
                          if (
                            confirm(
                              `Gỡ liên kết page "${i.name}"? Token sẽ bị xoá, ngừng up tự động từ page này.`,
                            )
                          )
                            void act(
                              i.id,
                              () =>
                                clientApi(`/pancake/pages/${i.id}`, {
                                  method: "DELETE",
                                }),
                              "Đã gỡ liên kết",
                            );
                        }}
                      >
                        Gỡ
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {shown.length > 0 && (
              <tr className="bg-slate-100 font-semibold">
                <td className={td} colSpan={3}>
                  Tổng
                </td>
                <td className={td}>{num(total.m)}</td>
                <td className={td}>{num(total.p)}</td>
                <td className={td}>
                  {total.m > 0
                    ? `${((total.p / total.m) * 100).toFixed(1).replace(".", ",")}%`
                    : "—"}
                </td>
                <td className={td}>{num(total.l)}</td>
                <td className={td} colSpan={2} />
              </tr>
            )}
            {items && shown.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  Chưa có page Pancake nào được liên kết
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PancakePostsTable from={from} to={to} canEditNote={canEditNote} />
      {showConnect && (
        <ConnectPancakeModal
          onClose={() => setShowConnect(false)}
          onDone={load}
        />
      )}
    </div>
  );
}

interface PancakePostItem {
  post_id: string;
  page: { id: string; name: string };
  message_count: number;
  phone_count: number;
  lead_count: number;
  is_selected: boolean;
  up_note: string | null;
}

/** Gom bài theo page (page xếp theo tên, bài giữ thứ tự từ server). */
function groupByPage(posts: PancakePostItem[]) {
  const map = new Map<string, { name: string; posts: PancakePostItem[] }>();
  for (const p of posts) {
    const g = map.get(p.page.id) ?? { name: p.page.name, posts: [] };
    g.posts.push(p);
    map.set(p.page.id, g);
  }
  return [...map.entries()]
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const postLink = (postId: string) => `https://www.facebook.com/${postId}`;

/**
 * Ghi chú khi up số theo bài: chỉ hiện bài đã chọn (nút "Chọn bài viết"), gom theo page — bấm
 * page để mở danh sách bài. Bài = bài của quảng cáo khách bấm (inbox) hoặc bài khách bình luận.
 * Data up tự động từ bài đang chọn mang ghi chú của bài; còn lại không có ghi chú.
 */
function PancakePostsTable({
  from,
  to,
  canEditNote,
}: {
  from: string;
  to: string;
  canEditNote: boolean;
}) {
  const toast = useToast();
  const [items, setItems] = useState<PancakePostItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await clientApi<{ items: PancakePostItem[] }>(
        `/pancake/posts?${new URLSearchParams({ from, to })}`,
      );
      setItems(r.items);
    } catch (e) {
      toast.error(errorText(e));
    }
  }, [from, to, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function saveNote(postId: string, value: string) {
    setBusyId(postId);
    try {
      await clientApi(`/pancake/posts/${postId}/up-note`, {
        method: "PATCH",
        body: JSON.stringify({ up_note: value }),
      });
      toast.success(
        value.trim() ? "Đã lưu ghi chú cho bài" : "Đã xoá ghi chú của bài",
      );
      await load();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  const toggle = (pageId: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });

  const td = "border border-slate-200 px-3 py-2";
  const groups = groupByPage((items ?? []).filter((p) => p.is_selected));

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Ghi chú theo bài
        </h2>
        {canEditNote && (
          <Button
            type="button"
            size="xs"
            disabled={!items}
            onClick={() => setShowPicker(true)}
          >
            Chọn bài viết
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
        <table className="w-full border-collapse text-sm [&_td]:text-center [&_th]:text-center">
          <thead className="bg-slate-700 text-xs font-semibold text-white">
            <tr>
              <th className={td}>Page</th>
              <th className={td}>Khách nhắn / bình luận</th>
              <th className={td}>Để lại SĐT</th>
              <th className={td}>Data đã up tự động</th>
              <th className={td}>Ghi chú khi up số</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isOpen = open.has(g.id);
              const sum = (k: "message_count" | "phone_count" | "lead_count") =>
                g.posts.reduce((s, p) => s + p[k], 0);
              return [
                <tr
                  key={g.id}
                  className="cursor-pointer bg-slate-50 font-medium hover:bg-slate-100"
                  onClick={() => toggle(g.id)}
                >
                  <td className={`${td} !text-left`}>
                    <span className="inline-block w-4 text-slate-500">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    {g.name}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      ({g.posts.length} bài)
                    </span>
                  </td>
                  <td className={td}>{num(sum("message_count"))}</td>
                  <td className={td}>{num(sum("phone_count"))}</td>
                  <td className={td}>{num(sum("lead_count"))}</td>
                  <td className={td} />
                </tr>,
                ...(isOpen
                  ? g.posts.map((p, idx) => (
                      <tr key={p.post_id}>
                        <td className={`${td} !text-left pl-8`}>
                          <a
                            href={postLink(p.post_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            title={p.post_id}
                          >
                            Bài {idx + 1} ↗
                          </a>
                        </td>
                        <td className={td}>{num(p.message_count)}</td>
                        <td className={td}>{num(p.phone_count)}</td>
                        <td className={td}>{num(p.lead_count)}</td>
                        <td className={`${td} min-w-48`}>
                          {canEditNote ? (
                            <UpNoteInput
                              key={p.up_note ?? ""}
                              value={p.up_note ?? ""}
                              disabled={busyId === p.post_id}
                              onSave={(v) => void saveNote(p.post_id, v)}
                            />
                          ) : (
                            (p.up_note ?? (
                              <span className="text-slate-400">—</span>
                            ))
                          )}
                        </td>
                      </tr>
                    ))
                  : []),
              ];
            })}
            {items && groups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  Chưa chọn bài nào
                  {canEditNote && " — bấm “Chọn bài viết” để chọn bài cần ghi chú"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {showPicker && items && (
        <SelectPostsModal
          items={items}
          onClose={() => setShowPicker(false)}
          onSaved={async () => {
            await load();
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}

/** Tick chọn bài sẽ hiện ở bảng ghi chú theo bài (lưu chung cho mọi người). */
function SelectPostsModal({
  items,
  onClose,
  onSaved,
}: {
  items: PancakePostItem[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(items.filter((p) => p.is_selected).map((p) => p.post_id)),
  );
  const [busy, setBusy] = useState(false);
  const groups = groupByPage(items);

  const flip = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    setBusy(true);
    try {
      await clientApi("/pancake/posts/selected", {
        method: "PUT",
        body: JSON.stringify({ post_ids: [...picked] }),
      });
      toast.success(`Đã chọn ${picked.size} bài`);
      await onSaved();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Chọn bài viết"
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Đang lưu…" : `Lưu (${picked.size} bài)`}
          </Button>
        </>
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">
          Chưa có bài nào có khách nhắn trong kỳ này.
        </p>
      ) : (
        <div className="space-y-4 text-sm">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="mb-1 font-semibold text-slate-700">{g.name}</div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {g.posts.map((p) => (
                  <li key={p.post_id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0"
                        checked={picked.has(p.post_id)}
                        onChange={() => flip(p.post_id)}
                      />
                      <a
                        href={postLink(p.post_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Xem bài ↗
                      </a>
                      <span className="flex-1 text-xs text-slate-500">
                        {num(p.message_count)} khách nhắn · {num(p.phone_count)} để lại
                        SĐT · {num(p.lead_count)} data
                      </span>
                      {p.up_note && (
                        <span
                          className="max-w-40 truncate text-xs text-slate-600"
                          title={p.up_note}
                        >
                          {p.up_note}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Ô "Ghi chú khi up số": gõ rồi bấm ra ngoài hoặc Enter là lưu; xoá trắng = bỏ ghi chú. */
function UpNoteInput({
  value,
  disabled,
  onSave,
  placeholder = "Không ghi chú",
}: {
  value: string;
  disabled: boolean;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    if (text.trim() !== value.trim()) onSave(text);
  };
  return (
    <Input
      uiSize="sm"
      value={text}
      maxLength={500}
      disabled={disabled}
      placeholder={placeholder}
      title={text || undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setText(value);
      }}
    />
  );
}

function ConnectPancakeModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await clientApi("/pancake/pages/connect", {
        method: "POST",
        body: JSON.stringify({ access_token: token.trim(), name: name.trim() }),
      });
      setToken(""); // không giữ token trên giao diện sau khi gửi
      toast.success("Đã liên kết page, đang lấy dữ liệu 30 ngày gần nhất");
      await onDone();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Liên kết page Pancake"
      description="Lấy token trong Pancake: Cài đặt page → Công cụ → API. Mỗi page một token."
      maxWidth="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="button"
            disabled={busy || token.trim().length < 20 || !name.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Đang kết nối…" : "Liên kết"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Field label="Tên page">
          <Input
            value={name}
            maxLength={255}
            placeholder="Vd: Page tuyển dụng A"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Token page Pancake">
          <Input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

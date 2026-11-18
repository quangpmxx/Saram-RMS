"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Flame, ImageUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { checkCanEdit, errorMessage } from "@/lib/editor";
import type { Job, Post, PostKind } from "@/lib/content-api";
import { formatDate } from "@/lib/content-api";

type Tab = "jobs" | "posts";
type JobForm = { title: string; company: string; area: string; salary: string; shift: string; description: string; image: string; urgent: boolean; published: boolean };
type PostForm = { kind: PostKind; title: string; summary: string; body: string; cover: string; images: string[]; published: boolean };

const EMPTY_JOB: JobForm = { title: "", company: "", area: "", salary: "", shift: "", description: "", image: "", urgent: false, published: true };
const EMPTY_POST: PostForm = { kind: "news", title: "", summary: "", body: "", cover: "", images: [], published: true };

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand";
const btn = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

/** Gọi CRM (qua /api); lỗi → ném Error có câu dễ hiểu. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/website/manage${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Không thực hiện được, thử lại sau."));
  return (await res.json()) as T;
}

async function upload(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/website/images", { method: "POST", body: form });
  if (!res.ok) throw new Error(await errorMessage(res, "Tải ảnh không thành công (JPG/PNG/WebP, tối đa 8MB)"));
  return ((await res.json()) as { url: string }).url;
}

/** Bỏ cache trang web để khách thấy tin mới ngay. */
const refreshSite = () => fetch("/lam-moi-noi-dung", { method: "POST" }).catch(() => undefined);

export function ManageClient() {
  const [can, setCan] = useState<boolean | null | "loading">("loading");
  const [tab, setTab] = useState<Tab>("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editJob, setEditJob] = useState<{ id: string | null; form: JobForm } | null>(null);
  const [editPost, setEditPost] = useState<{ id: string | null; form: PostForm } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<"job" | "cover" | "album">("job");

  const load = useCallback(async () => {
    try {
      const [j, p] = await Promise.all([api<Job[]>("/jobs"), api<Post[]>("/posts")]);
      setJobs(j);
      setPosts(p);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void checkCanEdit()
      .catch(() => false)
      .then((ok) => {
        setCan(ok);
        if (ok) void load();
      });
  }, [load]);

  async function run(fn: () => Promise<unknown>, done?: () => void) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      await refreshSite();
      await load();
      done?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const url = await upload(file);
      if (uploadFor.current === "job") setEditJob((s) => s && { ...s, form: { ...s.form, image: url } });
      else if (uploadFor.current === "cover") setEditPost((s) => s && { ...s, form: { ...s.form, cover: url } });
      else setEditPost((s) => s && { ...s, form: { ...s.form, images: [...s.form.images, url].slice(0, 100) } });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function pick(target: "job" | "cover" | "album") {
    uploadFor.current = target;
    if (fileInput.current) fileInput.current.multiple = target === "album";
    fileInput.current?.click();
  }

  if (can === "loading") return <p className="text-sm text-slate-500">Đang kiểm tra quyền…</p>;
  if (can === null)
    return (
      <p className="rounded-2xl bg-white p-6 text-sm">
        Bạn cần{" "}
        <Link href="/fix" className="font-semibold text-brand underline">
          đăng nhập
        </Link>{" "}
        bằng tài khoản CRM để quản lý tin.
      </p>
    );
  if (!can) return <p className="rounded-2xl bg-white p-6 text-sm">Tài khoản chưa có quyền “Sửa nội dung website”.</p>;

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`${btn} ${tab === t ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-ink"}`}
    >
      {label}
    </button>
  );

  const img = (url: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api${url}`} alt="" className="h-16 w-24 rounded-lg object-cover" />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Quản lý tin</h1>
        <div className="flex gap-2">
          {tabBtn("jobs", `Việc làm (${jobs.length})`)}
          {tabBtn("posts", `Tin tức & album (${posts.length})`)}
        </div>
      </div>
      {msg && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{msg}</p>}

      {tab === "jobs" && (
        <>
          {editJob ? (
            <form
              className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const body = JSON.stringify(editJob.form);
                void run(
                  () => (editJob.id ? api(`/jobs/${editJob.id}`, { method: "PATCH", body }) : api("/jobs", { method: "POST", body })),
                  () => setEditJob(null),
                );
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{editJob.id ? "Sửa tin việc làm" : "Đăng tin việc làm mới"}</p>
                <button type="button" onClick={() => setEditJob(null)} aria-label="Đóng">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {(
                [
                  ["title", "Tên việc *", "vd Công nhân lắp ráp tại Goertek"],
                  ["company", "Nhà máy / công ty", "vd Goertek Vina"],
                  ["area", "Nơi làm", "vd KCN Quế Võ, Bắc Ninh"],
                  ["salary", "Thu nhập", "vd 12 – 15 triệu/tháng"],
                  ["shift", "Ca làm", "vd Ca 12 tiếng, xoay ca"],
                ] as const
              ).map(([k, label, ph]) => (
                <label key={k} className="block text-sm">
                  {label}
                  <input
                    required={k === "title"}
                    minLength={k === "title" ? 3 : undefined}
                    value={editJob.form[k]}
                    placeholder={ph}
                    onChange={(e) => setEditJob({ ...editJob, form: { ...editJob.form, [k]: e.target.value } })}
                    className={input}
                  />
                </label>
              ))}
              <label className="block text-sm">
                Mô tả công việc, quyền lợi, yêu cầu
                <textarea
                  rows={6}
                  value={editJob.form.description}
                  onChange={(e) => setEditJob({ ...editJob, form: { ...editJob.form, description: e.target.value } })}
                  className={input}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {editJob.form.image && img(editJob.form.image)}
                <button type="button" className={`${btn} border border-slate-200`} disabled={busy} onClick={() => pick("job")}>
                  <ImageUp className="h-4 w-4" /> {editJob.form.image ? "Đổi ảnh" : "Thêm ảnh"}
                </button>
                {editJob.form.image && (
                  <button type="button" className="text-red-600 underline" onClick={() => setEditJob({ ...editJob, form: { ...editJob.form, image: "" } })}>
                    Bỏ ảnh
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editJob.form.urgent} onChange={(e) => setEditJob({ ...editJob, form: { ...editJob.form, urgent: e.target.checked } })} />
                  Tuyển gấp (lên đầu)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editJob.form.published} onChange={(e) => setEditJob({ ...editJob, form: { ...editJob.form, published: e.target.checked } })} />
                  Đăng lên web (bỏ chọn = lưu nháp)
                </label>
              </div>
              <button type="submit" disabled={busy} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>
                {busy ? "Đang lưu…" : "Lưu tin"}
              </button>
            </form>
          ) : (
            <button type="button" className={`${btn} bg-brand text-white hover:bg-brand-dark`} onClick={() => setEditJob({ id: null, form: EMPTY_JOB })}>
              <Plus className="h-4 w-4" /> Đăng tin việc làm
            </button>
          )}
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {j.urgent && <Flame className="mr-1 inline h-4 w-4 text-red-500" aria-label="Tuyển gấp" />}
                    {j.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[j.company, j.area, j.salary].filter(Boolean).join(" · ")} ·{" "}
                    <span className={j.published ? "text-emerald-600" : "text-amber-600"}>{j.published ? "Đang đăng" : "Nháp / đã ẩn"}</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Sửa"
                    className="rounded-lg p-2 hover:bg-slate-100"
                    onClick={() =>
                      setEditJob({
                        id: j.id,
                        form: {
                          title: j.title,
                          company: j.company ?? "",
                          area: j.area ?? "",
                          salary: j.salary ?? "",
                          shift: j.shift ?? "",
                          description: j.description ?? "",
                          image: j.image ?? "",
                          urgent: j.urgent,
                          published: j.published,
                        },
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={j.published ? "Ẩn khỏi web" : "Đăng lên web"}
                    className="rounded-lg p-2 hover:bg-slate-100"
                    disabled={busy}
                    onClick={() => void run(() => api(`/jobs/${j.id}`, { method: "PATCH", body: JSON.stringify({ published: !j.published }) }))}
                  >
                    {j.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    title="Xoá"
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => window.confirm(`Xoá hẳn tin “${j.title}”?`) && void run(() => api(`/jobs/${j.id}`, { method: "DELETE" }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {jobs.length === 0 && <li className="text-sm text-slate-500">Chưa có tin việc làm nào.</li>}
          </ul>
        </>
      )}

      {tab === "posts" && (
        <>
          {editPost ? (
            <form
              className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const body = JSON.stringify(editPost.form);
                void run(
                  () => (editPost.id ? api(`/posts/${editPost.id}`, { method: "PATCH", body }) : api("/posts", { method: "POST", body })),
                  () => setEditPost(null),
                );
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{editPost.id ? "Sửa bài" : "Viết bài mới"}</p>
                <button type="button" onClick={() => setEditPost(null)} aria-label="Đóng">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex gap-4 text-sm">
                {(["news", "album"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="radio" checked={editPost.form.kind === k} onChange={() => setEditPost({ ...editPost, form: { ...editPost.form, kind: k } })} />
                    {k === "news" ? "Tin tức" : "Album ảnh"}
                  </label>
                ))}
              </div>
              <label className="block text-sm">
                Tiêu đề *
                <input
                  required
                  minLength={3}
                  value={editPost.form.title}
                  onChange={(e) => setEditPost({ ...editPost, form: { ...editPost.form, title: e.target.value } })}
                  className={input}
                />
              </label>
              <label className="block text-sm">
                Tóm tắt (hiện ở danh sách và Google)
                <textarea
                  rows={2}
                  maxLength={500}
                  value={editPost.form.summary}
                  onChange={(e) => setEditPost({ ...editPost, form: { ...editPost.form, summary: e.target.value } })}
                  className={input}
                />
              </label>
              <label className="block text-sm">
                Nội dung
                <textarea
                  rows={10}
                  value={editPost.form.body}
                  onChange={(e) => setEditPost({ ...editPost, form: { ...editPost.form, body: e.target.value } })}
                  className={input}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>Ảnh bìa:</span>
                {editPost.form.cover && img(editPost.form.cover)}
                <button type="button" className={`${btn} border border-slate-200`} disabled={busy} onClick={() => pick("cover")}>
                  <ImageUp className="h-4 w-4" /> {editPost.form.cover ? "Đổi" : "Chọn"}
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  Ảnh trong bài / album ({editPost.form.images.length}):{" "}
                  <button type="button" className="font-semibold text-brand underline" disabled={busy} onClick={() => pick("album")}>
                    + Thêm ảnh (chọn được nhiều)
                  </button>
                </p>
                <div className="flex flex-wrap gap-2">
                  {editPost.form.images.map((u, i) => (
                    <span key={u} className="relative">
                      {img(u)}
                      <button
                        type="button"
                        aria-label="Bỏ ảnh"
                        className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white"
                        onClick={() => setEditPost({ ...editPost, form: { ...editPost.form, images: editPost.form.images.filter((_, j) => j !== i) } })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editPost.form.published} onChange={(e) => setEditPost({ ...editPost, form: { ...editPost.form, published: e.target.checked } })} />
                Đăng lên web (bỏ chọn = lưu nháp)
              </label>
              <button type="submit" disabled={busy} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>
                {busy ? "Đang lưu…" : "Lưu bài"}
              </button>
            </form>
          ) : (
            <button type="button" className={`${btn} bg-brand text-white hover:bg-brand-dark`} onClick={() => setEditPost({ id: null, form: EMPTY_POST })}>
              <Plus className="h-4 w-4" /> Viết bài / tạo album
            </button>
          )}
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-slate-500">
                    {p.kind === "album" ? `Album · ${p.images.length} ảnh` : "Tin tức"} · {formatDate(p.published_at ?? p.updated_at)} ·{" "}
                    <span className={p.published ? "text-emerald-600" : "text-amber-600"}>{p.published ? "Đang đăng" : "Nháp / đã ẩn"}</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Sửa"
                    className="rounded-lg p-2 hover:bg-slate-100"
                    onClick={() =>
                      setEditPost({
                        id: p.id,
                        form: { kind: p.kind, title: p.title, summary: p.summary ?? "", body: p.body ?? "", cover: p.cover ?? "", images: p.images, published: p.published },
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={p.published ? "Ẩn khỏi web" : "Đăng lên web"}
                    className="rounded-lg p-2 hover:bg-slate-100"
                    disabled={busy}
                    onClick={() => void run(() => api(`/posts/${p.id}`, { method: "PATCH", body: JSON.stringify({ published: !p.published }) }))}
                  >
                    {p.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    title="Xoá"
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => window.confirm(`Xoá hẳn bài “${p.title}”?`) && void run(() => api(`/posts/${p.id}`, { method: "DELETE" }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {posts.length === 0 && <li className="text-sm text-slate-500">Chưa có bài nào.</li>}
          </ul>
        </>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void (async () => {
            for (const f of files) await onFile(f);
          })();
        }}
      />
    </div>
  );
}

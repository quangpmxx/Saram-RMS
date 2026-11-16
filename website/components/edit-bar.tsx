"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LogOut, PencilLine, RotateCcw, X } from "lucide-react";
import { checkCanEdit, errorMessage, readEditorFlag, writeEditorFlag } from "@/lib/editor";

/**
 * Thanh "Chế độ sửa" — chỉ hiện trên máy đã đăng nhập ở /dang-nhap.
 * Bật sửa: mọi đoạn chữ [data-k] gõ sửa được tại chỗ; bấm ảnh [data-img-k] để chọn ảnh mới
 * (components/editable.tsx). Lưu gửi về CRM.
 */
export function EditBar() {
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dirty = useRef(new Map<string, string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const imageTarget = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Đọc cờ sau khi trang đã hiện để không lệch với bản dựng sẵn ở máy chủ.
    const t = setTimeout(() => setVisible(readEditorFlag()), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!editing) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-k]"));
    document.documentElement.dataset.editing = "1";
    nodes.forEach((el) => {
      el.contentEditable = "plaintext-only";
      el.spellcheck = false;
    });

    const onInput = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-k]");
      if (!el?.dataset.k) return;
      dirty.current.set(el.dataset.k, el.innerText.trim());
      el.dataset.dirty = "1";
      setDirtyCount(dirty.current.size);
    };
    const onFocus = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-k]");
      if (el?.dataset.k) setFocusedKey(el.dataset.k);
    };
    // Chữ nằm trong nút/đường dẫn: bấm để sửa, không chuyển trang. Bấm ảnh: chọn ảnh mới.
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const img = target.closest<HTMLImageElement>("img[data-img-k]");
      if (img) {
        e.preventDefault();
        e.stopPropagation();
        imageTarget.current = img;
        setFocusedKey(img.dataset.imgK ?? null);
        fileInput.current?.click();
        return;
      }
      if (target.closest("[data-k]") && target.closest("a,button")) e.preventDefault();
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current.size > 0) e.preventDefault();
    };
    document.addEventListener("input", onInput);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      delete document.documentElement.dataset.editing;
      nodes.forEach((el) => el.removeAttribute("contenteditable"));
      document.removeEventListener("input", onInput);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [editing]);

  const refreshAndReload = useCallback(async () => {
    await fetch("/lam-moi-noi-dung", { method: "POST" }).catch(() => undefined);
    dirty.current.clear();
    window.location.reload();
  }, []);

  async function uploadImage(file: File) {
    const img = imageTarget.current;
    const key = img?.dataset.imgK;
    if (!img || !key) return;
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/website/images", { method: "POST", body: form });
      if (!res.ok) {
        setMsg(await errorMessage(res, "Tải ảnh không thành công (ảnh JPG/PNG/WebP, tối đa 8MB)"));
        return;
      }
      const { url } = (await res.json()) as { url: string };
      img.removeAttribute("srcset");
      img.src = `/api${url}`;
      img.dataset.dirty = "1";
      dirty.current.set(key, url);
      setDirtyCount(dirty.current.size);
    } catch {
      setMsg("Không kết nối được máy chủ, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setMsg("");
    const can = await checkCanEdit().catch(() => false);
    if (can === null) {
      writeEditorFlag(false);
      window.location.href = "/dang-nhap";
      return;
    }
    if (!can) {
      setMsg("Tài khoản chưa có quyền “Sửa nội dung website”.");
      return;
    }
    setEditing(true);
  }

  async function save() {
    if (dirty.current.size === 0) return;
    if (Array.from(dirty.current.values()).some((v) => v === "")) {
      setMsg("Có đoạn chữ bị xoá trống — gõ lại chữ hoặc bấm “Về bản gốc”.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const items = Array.from(dirty.current, ([key, value]) => ({ key, value }));
      const res = await fetch("/api/website/texts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        setMsg(await errorMessage(res, "Lưu không thành công"));
        return;
      }
      await refreshAndReload();
    } catch {
      setMsg("Không kết nối được máy chủ, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  async function resetFocused() {
    if (!focusedKey) {
      setMsg("Bấm vào đoạn chữ hoặc ảnh muốn đưa về bản gốc trước.");
      return;
    }
    if (!window.confirm("Đưa chữ/ảnh đang chọn về bản gốc ban đầu?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/website/texts/${encodeURIComponent(focusedKey)}`, { method: "DELETE" });
      if (!res.ok) {
        setMsg(await errorMessage(res, "Không đưa về bản gốc được"));
        return;
      }
      dirty.current.delete(focusedKey);
      await refreshAndReload();
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (dirty.current.size > 0) {
      if (!window.confirm("Bỏ các chỗ vừa sửa chưa lưu?")) return;
      dirty.current.clear();
      window.location.reload();
      return;
    }
    setEditing(false);
  }

  async function logout() {
    if (dirty.current.size > 0 && !window.confirm("Bỏ các chỗ vừa sửa chưa lưu?")) return;
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    writeEditorFlag(false);
    dirty.current.clear();
    window.location.reload();
  }

  if (!visible) return null;

  const btn = "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="fixed bottom-20 left-4 z-50 max-w-[calc(100vw-2rem)] sm:bottom-4 sm:max-w-[calc(100vw-6rem)] rounded-2xl bg-ink p-2 text-white shadow-2xl">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <span className="px-2 text-sm text-orange-300">
              Đang sửa{dirtyCount > 0 ? ` · ${dirtyCount} chỗ chưa lưu` : ""}
            </span>
            <button type="button" onClick={save} disabled={busy || dirtyCount === 0} className={`${btn} bg-brand hover:bg-brand-dark`}>
              <Check className="h-4 w-4" aria-hidden="true" /> Lưu
            </button>
            <button type="button" onClick={resetFocused} disabled={busy} className={`${btn} bg-white/10 hover:bg-white/20`}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Về bản gốc
            </button>
            <button type="button" onClick={cancel} disabled={busy} className={`${btn} bg-white/10 hover:bg-white/20`}>
              <X className="h-4 w-4" aria-hidden="true" /> Thoát
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={start} className={`${btn} bg-brand hover:bg-brand-dark`}>
              <PencilLine className="h-4 w-4" aria-hidden="true" /> Sửa nội dung
            </button>
            <button type="button" onClick={logout} className={`${btn} bg-white/10 hover:bg-white/20`} aria-label="Đăng xuất">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {editing && <p className="px-2 pt-1.5 text-xs text-slate-400">Bấm vào chữ để gõ sửa · bấm vào ảnh để đổi ảnh</p>}
      {msg && <p className="px-2 pt-2 text-xs text-red-300">{msg}</p>}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadImage(file);
        }}
      />
    </div>
  );
}

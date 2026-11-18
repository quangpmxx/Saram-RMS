"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  Check,
  Eye,
  EyeOff,
  FileText,
  History,
  LayoutList,
  Newspaper,
  SquarePlus,
  Trash2,
  ImageUp,
  Italic,
  Link2,
  LogOut,
  Maximize2,
  Minimize2,
  Minus,
  PencilLine,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  Smartphone,
  Underline,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { checkCanEdit, errorMessage, readEditorFlag, writeEditorFlag } from "@/lib/editor";
import {
  BTN_SUFFIX,
  BUTTON_VARIANTS,
  FONTS,
  HREF_SUFFIX,
  SCALE_MAX,
  SCALE_MIN,
  SIZE_STEPS,
  STYLE_SUFFIX,
  THEME_DEFAULTS,
  blockStyleVars,
  fontVar,
  imageStyleCss,
  isEmail,
  isFontKey,
  isGa4Id,
  isPhone,
  isPixelId,
  isSafeHref,
  isZaloOaId,
  parseBlockStyle,
  parseImageStyle,
  parseTextStyle,
  textStyleCss,
  themeVars,
  type BlockPad,
  type BlockStyle,
  type ButtonVariant,
  type ImageStyle,
  type TextStyle,
  type Theme,
} from "@/lib/style";
import { isListName, type ListName } from "@/lib/lists";
import { BLOCK_TYPES, isPageSlug, newBlockId, parseCustomBlocks, slugify, youtubeId, type BlockType, type CustomBlock, type CustomPage } from "@/lib/pages";
import { HistoryPanel, ListEditor } from "./edit-panels";

type SiteProps = {
  hotline: string;
  zalo: string;
  email: string;
  address: string;
  fb_pixel: string;
  ga4: string;
  zalo_oa: string;
  og_image: string;
};
/** Phần tử giữ qua hàm (không để thẳng trong state) — vì chế độ sửa thao tác trực tiếp lên DOM. */
type Selection = { kind: "text"; key: string; el: () => HTMLElement } | { kind: "image"; key: string; el: () => HTMLImageElement } | null;
type HistoryEntry = { undo: () => void; redo: () => void; tag?: string; at: number };
type UploadTarget = "image" | "block" | "og";

const COLORS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "Màu gốc" },
  { value: "#f26b1d", label: "Cam" },
  { value: "#1f4fd8", label: "Xanh dương" },
  { value: "#0b1733", label: "Xanh than" },
  { value: "#ffffff", label: "Trắng" },
  { value: "#000000", label: "Đen" },
  { value: "#64748b", label: "Xám" },
  { value: "#dc2626", label: "Đỏ" },
  { value: "#16a34a", label: "Xanh lá" },
  { value: "#f59e0b", label: "Vàng" },
];
const BG_COLORS = ["#ffffff", "#f8fafc", "#fff3eb", "#eef2ff", "#0b1733", "#142347", "#f26b1d", "#1f4fd8"];
const PADS: { value: BlockPad | undefined; label: string }[] = [
  { value: "sm", label: "Gọn" },
  { value: undefined, label: "Vừa" },
  { value: "lg", label: "Rộng" },
  { value: "xl", label: "Rất rộng" },
];
const BTN_LABELS: Record<ButtonVariant, string> = { primary: "Cam", light: "Trắng", outline: "Viền" };
const ALL_BTN_CLASSES = Object.values(BUTTON_VARIANTS).flatMap((c) => c.split(" "));

const byKey = (key: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-k="${CSS.escape(key)}"]`));

function applyTextCss(el: HTMLElement, s: TextStyle) {
  el.removeAttribute("style");
  Object.assign(el.style, textStyleCss(s) as unknown as Partial<CSSStyleDeclaration>);
  if (s.hidden) el.dataset.hidden = "";
  else delete el.dataset.hidden;
}

function applyBlockStyle(el: HTMLElement, s: BlockStyle) {
  el.dataset.blockStyle = JSON.stringify(s);
  el.style.removeProperty("--sec-bg");
  el.style.removeProperty("--sec-pad");
  for (const [k, v] of Object.entries(blockStyleVars(s))) el.style.setProperty(k, v);
  if (s.bg || s.img) el.dataset.bg = "";
  else delete el.dataset.bg;
  if (s.pad) el.dataset.pad = "";
  else delete el.dataset.pad;
}

function applyButton(a: HTMLElement, v: ButtonVariant) {
  a.classList.remove(...ALL_BTN_CLASSES);
  a.classList.add(...BUTTON_VARIANTS[v].split(" "));
  a.dataset.btn = v;
}

function applyTheme(th: Theme) {
  const rootEl = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(th))) rootEl.style.setProperty(k, v);
  rootEl.style.fontSize = th.scale === 100 ? "" : `${th.scale}%`;
  if (isFontKey(th.font) && th.font !== THEME_DEFAULTS.font) rootEl.style.setProperty("--font-pick", `var(${fontVar(th.font)})`);
  else rootEl.style.removeProperty("--font-pick");
}

/**
 * Thanh "Chế độ sửa" — chỉ hiện trên máy đã đăng nhập ở /fix.
 * - Bấm chữ [data-k]: gõ sửa; thanh kiểu chữ (cỡ, màu, đậm/nghiêng/gạch chân, căn lề, ẩn); chữ trên nút
 *   [data-href-k] → đổi đường dẫn + kiểu nút.
 * - Bấm ảnh [data-img-k]: đổi ảnh, lấp đầy/vừa khung, dời, phóng to.
 * - Khối [data-sec] đang chọn: lên/xuống, ẩn/hiện, màu/ảnh nền, khoảng cách.
 * - Hoàn tác / làm lại (Ctrl+Z / Ctrl+Y) mọi thao tác chưa lưu; gõ chữ dùng hoàn tác sẵn của trình duyệt.
 * - "Cài đặt chung": màu, font, cỡ chữ cả trang, liên hệ, mã theo dõi, ảnh chia sẻ. "Trang này": Google, bố cục gốc.
 * - "Điện thoại": xem thử bản đã lưu trong khung điện thoại.
 * Mọi thứ lưu một lần bằng nút Lưu (website_texts trong CRM, xem lib/style.ts + lib/site.ts).
 */
export function EditBar({ site, theme, pages }: { site: SiteProps; theme: Theme; pages: CustomPage[] }) {
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [sel, setSel] = useState<Selection>(null);
  const [blockBox, setBlockBox] = useState<{ el: () => HTMLElement } | null>(null);
  const block = blockBox?.el() ?? null;
  const [panel, setPanel] = useState<null | "site" | "page" | "history">(null);
  /** Danh sách [data-list] đang bấm vào + bảng "Sửa danh sách" đang mở. */
  const [listBox, setListBox] = useState<{ el: () => HTMLElement } | null>(null);
  const [listModal, setListModal] = useState<{ name: ListName; rows: ({ id: string; _label?: string } & Record<string, string>)[] } | null>(null);
  const [addMenu, setAddMenu] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [siteVals, setSiteVals] = useState(site);
  const [themeVals, setThemeVals] = useState(theme);
  const [seo, setSeo] = useState<{ page: string; title: string; desc: string; titleDefault: string; descDefault: string } | null>(null);
  const dirty = useRef(new Map<string, string>());
  /** Mã chữ thường (không được để trống khi lưu). */
  const textKeys = useRef(new Set<string>());
  const past = useRef<HistoryEntry[]>([]);
  const future = useRef<HistoryEntry[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<UploadTarget>("image");
  const root = useRef<HTMLDivElement>(null);

  /** Số bước hoàn tác / làm lại (để bật tắt nút — không đọc ref lúc vẽ). */
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const syncHist = useCallback(() => setHist({ past: past.current.length, future: future.current.length }), []);
  const markDirty = useCallback((key: string, value: string) => {
    dirty.current.set(key, value);
    setDirtyCount(dirty.current.size);
  }, []);

  /**
   * Ghi một thao tác có hoàn tác: `entries` = mã → giá trị lưu mới; doIt/undoIt đổi DOM.
   * `tag`: thao tác cùng loại liên tiếp (vd kéo thanh cỡ chữ) gộp thành một bước hoàn tác.
   */
  const commit = useCallback((entries: [string, string][], doIt: () => void, undoIt: () => void, tag?: string) => {
    const prev = entries.map(([k]) => [k, dirty.current.get(k)] as const);
    const setVals = (vals: readonly (readonly [string, string | undefined])[]) => {
      for (const [k, v] of vals) {
        if (v === undefined) dirty.current.delete(k);
        else dirty.current.set(k, v);
      }
      setDirtyCount(dirty.current.size);
      setTick((t) => t + 1);
    };
    doIt();
    setVals(entries);
    const now = Date.now();
    const last = past.current[past.current.length - 1];
    if (tag && last?.tag === tag && now - last.at < 1500) {
      last.redo = () => {
        doIt();
        setVals(entries);
      };
      last.at = now;
    } else {
      past.current.push({
        undo: () => {
          undoIt();
          setVals(prev);
        },
        redo: () => {
          doIt();
          setVals(entries);
        },
        tag,
        at: now,
      });
    }
    future.current = [];
    syncHist();
  }, [syncHist]);

  const undo = useCallback(() => {
    const e = past.current.pop();
    if (!e) return;
    e.undo();
    future.current.push(e);
    syncHist();
  }, [syncHist]);
  const redo = useCallback(() => {
    const e = future.current.pop();
    if (!e) return;
    e.redo();
    past.current.push(e);
    syncHist();
  }, [syncHist]);

  useEffect(() => {
    // Đọc cờ sau khi trang đã hiện để không lệch với bản dựng sẵn ở máy chủ. Trong khung xem thử thì ẩn.
    const t = setTimeout(() => setVisible(readEditorFlag() && window.self === window.top), 0);
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
      const key = el?.dataset.k;
      if (!el || !key) return;
      textKeys.current.add(key);
      dirty.current.set(key, el.innerText.trim());
      el.dataset.dirty = "1";
      setDirtyCount(dirty.current.size);
    };
    const onFocus = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-k]");
      if (el?.dataset.k) setSel({ kind: "text", key: el.dataset.k, el: () => el });
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (root.current?.contains(target)) return;
      const sec = target.closest<HTMLElement>("[data-sec]");
      if (sec) setBlockBox({ el: () => sec });
      const list = target.closest<HTMLElement>("[data-list]");
      setListBox(list ? { el: () => list } : null);
      const img = target.closest<HTMLImageElement>("img[data-img-k]");
      if (img) {
        e.preventDefault();
        e.stopPropagation();
        setSel({ kind: "image", key: img.dataset.imgK ?? "", el: () => img });
        return;
      }
      const link = target.closest("a,button");
      if (!link) return;
      // Chữ trong nút/đường dẫn: bấm để sửa, không chuyển trang.
      if (target.closest("[data-k]")) {
        e.preventDefault();
        return;
      }
      // Chuyển trang khi đang sửa: còn chỗ chưa lưu thì chặn; không thì tắt chế độ sửa rồi đi.
      if (link.tagName === "A") {
        if (dirty.current.size > 0) {
          e.preventDefault();
          e.stopPropagation();
          setMsg("Còn chỗ chưa lưu — bấm Lưu (hoặc Thoát) trước khi sang trang khác.");
        } else {
          setEditing(false);
        }
      }
    };
    // Ctrl+Z / Ctrl+Y: hoàn tác thao tác của thanh sửa (khi không đang gõ chữ / ô nhập).
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current.size > 0) e.preventDefault();
    };
    document.addEventListener("input", onInput);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      delete document.documentElement.dataset.editing;
      nodes.forEach((el) => el.removeAttribute("contenteditable"));
      document.removeEventListener("input", onInput);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
      setSel(null);
      setBlockBox(null);
      setPanel(null);
    };
  }, [editing, undo, redo]);

  // Đánh dấu khối / ảnh đang chọn (viền xanh).
  useEffect(() => {
    const el = blockBox?.el();
    if (!el) return;
    el.dataset.secSelected = "";
    return () => {
      delete el.dataset.secSelected;
    };
  }, [blockBox]);
  useEffect(() => {
    if (sel?.kind !== "image") return;
    const el = sel.el();
    el.dataset.selected = "";
    return () => {
      delete el.dataset.selected;
    };
  }, [sel]);

  /** Bỏ cache trang web rồi tải lại (hoặc chuyển sang `goTo` — vd trang vừa tạo). */
  const refreshAndReload = useCallback(async (goTo?: string) => {
    await fetch("/lam-moi-noi-dung", { method: "POST" }).catch(() => undefined);
    dirty.current.clear();
    if (goTo) window.location.href = goTo;
    else window.location.reload();
  }, []);

  /* ---------- Chữ ---------- */
  const textStyle = (): TextStyle => (sel?.kind === "text" ? parseTextStyle(sel.el().dataset.style) : {});

  function updateText(patch: Partial<TextStyle>) {
    if (sel?.kind !== "text") return;
    const key = sel.key;
    const prev = textStyle();
    const next = parseTextStyle(JSON.stringify({ ...prev, ...patch }));
    const set = (s: TextStyle) =>
      byKey(key).forEach((el) => {
        el.dataset.style = JSON.stringify(s);
        el.dataset.dirty = "1";
        applyTextCss(el, s);
      });
    commit([[key + STYLE_SUFFIX, JSON.stringify(next)]], () => set(next), () => set(prev));
  }

  function changeSize(dir: 1 | -1) {
    const cur = textStyle().size ?? 1;
    let i = SIZE_STEPS.findIndex((s) => s >= cur - 0.001);
    if (i < 0) i = SIZE_STEPS.length - 1;
    const next = SIZE_STEPS[Math.min(SIZE_STEPS.length - 1, Math.max(0, i + dir))];
    updateText({ size: next === 1 ? undefined : next });
  }

  function toggleFlag(flag: "b" | "i" | "u") {
    if (sel?.kind !== "text") return;
    const cs = getComputedStyle(sel.el());
    const computed =
      flag === "b" ? Number(cs.fontWeight) >= 600 : flag === "i" ? cs.fontStyle === "italic" : cs.textDecorationLine.includes("underline");
    updateText({ [flag]: !(textStyle()[flag] ?? computed) });
  }

  const linkEl = () => (sel?.kind === "text" ? sel.el().closest<HTMLAnchorElement>("a[data-href-k]") : null);

  function changeLink() {
    const a = linkEl();
    const hk = a?.dataset.hrefK;
    if (!a || !hk) return;
    const prev = a.getAttribute("href") ?? "";
    const v = window.prompt("Nút này dẫn tới đâu?\nVí dụ: /lien-he · /viec-lam · https://zalo.me/0971242250 · tel:0971242250", prev);
    if (v === null) return;
    if (!isSafeHref(v)) {
      setMsg("Đường dẫn không hợp lệ — bắt đầu bằng /, https://, tel: hoặc mailto:");
      return;
    }
    setMsg("");
    commit([[hk + HREF_SUFFIX, v.trim()]], () => a.setAttribute("href", v.trim()), () => a.setAttribute("href", prev));
  }

  function changeButton(v: ButtonVariant) {
    const a = linkEl();
    const hk = a?.dataset.hrefK;
    if (!a || !hk) return;
    const prev = (a.dataset.btn as ButtonVariant | undefined) ?? "primary";
    if (prev === v) return;
    commit([[hk + BTN_SUFFIX, v]], () => applyButton(a, v), () => applyButton(a, prev));
  }

  /* ---------- Ảnh ---------- */
  const imageStyle = (): ImageStyle => (sel?.kind === "image" ? parseImageStyle(sel.el().dataset.style) : {});

  function updateImage(patch: Partial<ImageStyle>, tag?: string) {
    if (sel?.kind !== "image") return;
    const el = sel.el();
    const prev = imageStyle();
    const next = parseImageStyle(JSON.stringify({ ...prev, ...patch }));
    const set = (s: ImageStyle) => {
      el.dataset.style = JSON.stringify(s);
      el.dataset.dirty = "1";
      Object.assign(el.style, imageStyleCss(s));
    };
    commit([[sel.key + STYLE_SUFFIX, JSON.stringify(next)]], () => set(next), () => set(prev), tag);
  }

  function moveImage(dx: number, dy: number) {
    const s = imageStyle();
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    updateImage({ x: clamp((s.x ?? 50) + dx), y: clamp((s.y ?? 50) + dy) });
  }

  function zoomImage(dir: 1 | -1) {
    const z = Math.round(((imageStyle().zoom ?? 1) + dir * 0.1) * 10) / 10;
    updateImage({ zoom: z <= 1 ? undefined : Math.min(3, z) });
  }

  function toggleFit() {
    if (sel?.kind !== "image") return;
    const cur = imageStyle().fit ?? getComputedStyle(sel.el()).objectFit;
    updateImage({ fit: cur === "contain" ? "cover" : "contain" });
  }

  function pickFile(target: UploadTarget) {
    uploadTarget.current = target;
    fileInput.current?.click();
  }

  /** Tải ảnh lên CRM → trả đường dẫn /uploads/website/… (null nếu lỗi, đã báo lỗi). */
  async function uploadFile(file: File): Promise<string | null> {
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/website/images", { method: "POST", body: form });
      if (!res.ok) {
        setMsg(await errorMessage(res, "Tải ảnh không thành công (ảnh JPG/PNG/WebP, tối đa 8MB)"));
        return null;
      }
      return ((await res.json()) as { url: string }).url;
    } catch {
      setMsg("Không kết nối được máy chủ, thử lại sau.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    const target = uploadTarget.current;
    // Giữ phần tử đích trước khi chờ tải (người dùng có thể bấm chỗ khác trong lúc chờ).
    const img = target === "image" && sel?.kind === "image" ? sel.el() : null;
    const imgKey = sel?.kind === "image" ? sel.key : "";
    const blk = target === "block" ? block : null;
    const url = await uploadFile(file);
    if (!url) return;
    if (img) {
      const prevSrc = img.getAttribute("src") ?? "";
      const prevSrcset = img.getAttribute("srcset");
      const prevDirty = img.dataset.dirty;
      commit(
        [[imgKey, url]],
        () => {
          img.removeAttribute("srcset");
          img.src = `/api${url}`;
          img.dataset.dirty = "1";
        },
        () => {
          img.setAttribute("src", prevSrc);
          if (prevSrcset) img.setAttribute("srcset", prevSrcset);
          if (prevDirty === undefined) delete img.dataset.dirty;
        },
      );
    } else if (blk) {
      updateBlock({ img: url, bg: undefined }, blk);
    } else if (target === "og") {
      const prev = siteVals.og_image;
      commit(
        [["site.og_image", url]],
        () => setSiteVals((v) => ({ ...v, og_image: url })),
        () => setSiteVals((v) => ({ ...v, og_image: prev })),
      );
    }
  }

  /* ---------- Khối ---------- */
  const blockStyle = (): BlockStyle => (block ? parseBlockStyle(block.dataset.blockStyle) : {});

  function blockKey(el: HTMLElement) {
    const page = el.parentElement?.dataset.blocks;
    return page && el.dataset.sec ? `block.${page}.${el.dataset.sec}` : null;
  }

  function updateBlock(patch: Partial<BlockStyle>, target?: HTMLElement | null) {
    const el = target ?? blockBox?.el();
    if (!el) return;
    const key = blockKey(el);
    if (!key) return;
    const prev = parseBlockStyle(el.dataset.blockStyle);
    const next = parseBlockStyle(JSON.stringify({ ...prev, ...patch }));
    commit([[key, JSON.stringify(next)]], () => applyBlockStyle(el, next), () => applyBlockStyle(el, prev));
  }

  function layoutValue(container: HTMLElement) {
    const secs = Array.from(container.children).filter((c): c is HTMLElement => c instanceof HTMLElement && !!c.dataset.sec);
    return JSON.stringify({ order: secs.map((s) => s.dataset.sec), hidden: secs.filter((s) => s.dataset.secHidden !== undefined).map((s) => s.dataset.sec) });
  }

  function moveBlock(dir: -1 | 1) {
    const el = blockBox?.el();
    const container = el?.parentElement;
    if (!el || !container?.dataset.blocks) return;
    const sib = (dir < 0 ? el.previousElementSibling : el.nextElementSibling) as HTMLElement | null;
    if (!sib?.dataset.sec) return;
    const swap = (up: boolean) => {
      if (up) container.insertBefore(el, sib);
      else container.insertBefore(sib, el);
    };
    // Lên: chèn el trước sib; hoàn tác = chèn sib trước el (và ngược lại).
    const doIt = () => swap(dir < 0);
    const undoIt = () => swap(dir > 0);
    doIt();
    const value = layoutValue(container);
    undoIt();
    commit([[`layout.${container.dataset.blocks}`, value]], doIt, undoIt);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleBlock() {
    const el = blockBox?.el();
    const container = el?.parentElement;
    if (!el || !container?.dataset.blocks) return;
    const wasHidden = el.dataset.secHidden !== undefined;
    const set = (hide: boolean) => {
      if (hide) el.dataset.secHidden = "";
      else delete el.dataset.secHidden;
    };
    set(!wasHidden);
    const value = layoutValue(container);
    set(wasHidden);
    commit([[`layout.${container.dataset.blocks}`, value]], () => set(!wasHidden), () => set(wasHidden));
  }

  /* ---------- Cài đặt chung + Trang này ---------- */
  function setTheme(patch: Partial<Theme>) {
    const prev = themeVals;
    const next = { ...themeVals, ...patch };
    const entries = (Object.keys(patch) as (keyof Theme)[]).map((k) => [`theme.${k}`, String(next[k])] as [string, string]);
    commit(
      entries,
      () => {
        setThemeVals(next);
        applyTheme(next);
      },
      () => {
        setThemeVals(prev);
        applyTheme(prev);
      },
      `theme.${Object.keys(patch).join(",")}`,
    );
  }

  function setSite(field: keyof SiteProps, value: string) {
    setSiteVals((v) => ({ ...v, [field]: value }));
    // Ô mã theo dõi để trống = không dùng → xoá khi lưu (xem save()).
    markDirty(`site.${field}`, value.trim());
  }

  function openPage() {
    const c = document.querySelector<HTMLElement>("[data-blocks]");
    setSeo(
      c?.dataset.blocks
        ? {
            page: c.dataset.blocks,
            title: dirty.current.get(`seo.${c.dataset.blocks}.title`) ?? c.dataset.seoTitle ?? "",
            desc: dirty.current.get(`seo.${c.dataset.blocks}.desc`) ?? c.dataset.seoDesc ?? "",
            titleDefault: c.dataset.seoTitleDefault ?? "",
            descDefault: c.dataset.seoDescDefault ?? "",
          }
        : null,
    );
    setPanel(panel === "page" ? null : "page");
  }

  /* ---------- Danh sách ---------- */
  function openListEditor() {
    const el = listBox?.el();
    const name = el?.dataset.list;
    if (!el || !isListName(name)) return;
    try {
      setListModal({ name, rows: JSON.parse(el.dataset.listItems ?? "[]") });
    } catch {
      setMsg("Không đọc được danh sách này.");
    }
  }

  /** Lưu danh sách = lưu luôn mọi chỗ đang sửa rồi tải lại (mục mới cần máy chủ vẽ lại). */
  function applyList(json: string) {
    if (!listModal) return;
    if (dirty.current.size > 0 && !window.confirm(`Lưu danh sách sẽ lưu luôn ${dirty.current.size} chỗ đang sửa khác. Tiếp tục?`)) return;
    markDirty(`list.${listModal.name}`, json);
    setListModal(null);
    void save();
  }

  /* ---------- Khối thêm từ mẫu ---------- */
  const pageBox = () => document.querySelector<HTMLElement>("[data-blocks]");
  const customBlocks = (): CustomBlock[] => parseCustomBlocks(pageBox()?.dataset.custom);
  const selectedCustom = (): CustomBlock | null => (block?.dataset.sec?.startsWith("c-") ? (customBlocks().find((c) => c.id === block.dataset.sec) ?? null) : null);

  /** Ghi custom.<trang> (+ thứ tự nếu có) rồi lưu tất cả và tải lại — khối mới cần máy chủ vẽ. */
  function commitCustom(next: CustomBlock[], order: string[] | null, what: string) {
    const box = pageBox();
    const page = box?.dataset.blocks;
    if (!box || !page) return;
    if (dirty.current.size > 0 && !window.confirm(`${what} sẽ lưu luôn ${dirty.current.size} chỗ đang sửa khác. Tiếp tục?`)) return;
    markDirty(`custom.${page}`, JSON.stringify(next));
    if (order) {
      const secs = Array.from(box.children).filter((c): c is HTMLElement => c instanceof HTMLElement && !!c.dataset.sec);
      const hidden = secs.filter((s) => s.dataset.secHidden !== undefined).map((s) => s.dataset.sec);
      markDirty(`layout.${page}`, JSON.stringify({ order, hidden }));
    }
    void save();
  }

  function addBlock(type: BlockType) {
    const box = pageBox();
    if (!box) {
      setMsg("Trang này không thêm khối được.");
      return;
    }
    setAddMenu(false);
    const id = newBlockId();
    const nb: CustomBlock = { id, type, ...(type === "faq" ? { n: 3 } : {}) };
    const order = Array.from(box.children)
      .map((c) => (c as HTMLElement).dataset.sec)
      .filter((v): v is string => !!v);
    // Chèn ngay dưới khối đang chọn (chưa chọn → cuối trang).
    const at = block?.dataset.sec ? order.indexOf(block.dataset.sec) + 1 : order.length;
    order.splice(at > 0 ? at : order.length, 0, id);
    commitCustom([...customBlocks(), nb], order, "Thêm khối");
  }

  function updateCustom(patch: Partial<CustomBlock>) {
    const cur = selectedCustom();
    if (!cur) return;
    commitCustom(
      customBlocks().map((c) => (c.id === cur.id ? { ...c, ...patch } : c)),
      null,
      "Đổi cấu hình khối",
    );
  }

  function deleteCustom() {
    const cur = selectedCustom();
    if (!cur || !window.confirm(`Xoá khối “${BLOCK_TYPES[cur.type].label}” khỏi trang?`)) return;
    commitCustom(
      customBlocks().filter((c) => c.id !== cur.id),
      null,
      "Xoá khối",
    );
  }

  function setVideo() {
    const v = window.prompt("Dán link YouTube (vd https://youtu.be/abc123XYZ45):", "");
    if (v === null) return;
    const id = youtubeId(v);
    if (!id) {
      setMsg("Link YouTube không hợp lệ.");
      return;
    }
    updateCustom({ video: id });
  }

  /* ---------- Trang tự thêm ---------- */
  function addPage() {
    const title = window.prompt("Tên trang mới (vd: Tuyển dụng Foxconn):", "")?.trim();
    if (!title) return;
    const slug = window.prompt("Đường dẫn trang (chỉ chữ không dấu, số, gạch ngang):", slugify(title))?.trim();
    if (!slug) return;
    if (!isPageSlug(slug) || pages.some((p) => p.slug === slug)) {
      setMsg("Đường dẫn không hợp lệ hoặc đã có trang dùng.");
      return;
    }
    const menu = window.confirm("Hiện trang này trên menu trên cùng?");
    if (dirty.current.size > 0 && !window.confirm(`Tạo trang sẽ lưu luôn ${dirty.current.size} chỗ đang sửa khác. Tiếp tục?`)) return;
    markDirty("pages", JSON.stringify([...pages, { slug, title: title.slice(0, 120), menu }]));
    void save(`/${slug}`);
  }

  function updatePage(slug: string, patch: Partial<CustomPage> | null) {
    const next = patch === null ? pages.filter((p) => p.slug !== slug) : pages.map((p) => (p.slug === slug ? { ...p, ...patch } : p));
    if (patch === null && !window.confirm("Xoá hẳn trang này? (Nội dung đã gõ trong trang sẽ không hiện nữa.)")) return;
    if (dirty.current.size > 0 && !window.confirm(`Sẽ lưu luôn ${dirty.current.size} chỗ đang sửa khác. Tiếp tục?`)) return;
    markDirty("pages", JSON.stringify(next));
    void save(patch === null ? "/" : undefined);
  }

  /* ---------- Lưu / về gốc ---------- */
  async function start() {
    setMsg("");
    const can = await checkCanEdit().catch(() => false);
    if (can === null) {
      writeEditorFlag(false);
      window.location.href = "/fix";
      return;
    }
    if (!can) {
      setMsg("Tài khoản chưa có quyền “Sửa nội dung website”.");
      return;
    }
    setEditing(true);
  }

  const TRACKING_KEYS = ["site.fb_pixel", "site.ga4", "site.zalo_oa"];

  function validate(): string | null {
    for (const [key, value] of dirty.current) {
      if (textKeys.current.has(key) && value === "") return "Có đoạn chữ bị xoá trống — gõ lại chữ hoặc bấm “Về bản gốc”.";
      if ((key === "site.hotline" || key === "site.zalo") && !isPhone(value)) return "Số điện thoại chỉ gồm chữ số, 8–15 số (vd 0971242250).";
      if (key === "site.email" && !isEmail(value)) return "Email không hợp lệ.";
      if (key === "site.address" && (!value || value.length > 300)) return "Địa chỉ không được trống (tối đa 300 ký tự).";
      if (key === "site.fb_pixel" && value && !isPixelId(value)) return "Mã Facebook Pixel là dãy 10–20 chữ số.";
      if (key === "site.ga4" && value && !isGa4Id(value)) return "Mã Google Analytics có dạng G-XXXXXXXXXX.";
      if (key === "site.zalo_oa" && value && !isZaloOaId(value)) return "Mã Zalo OA là dãy chữ số (xem trong trang quản lý Zalo OA).";
      if (key.startsWith("seo.") && key.endsWith(".title") && (!value || value.length > 120)) return "Tiêu đề Google không được trống (tối đa 120 ký tự).";
      if (key.startsWith("seo.") && key.endsWith(".desc") && (!value || value.length > 300)) return "Mô tả Google không được trống (tối đa 300 ký tự).";
    }
    return null;
  }

  async function save(goTo?: string) {
    if (dirty.current.size === 0) return;
    const err = validate();
    if (err) {
      setMsg(err);
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      // Mã theo dõi để trống = bỏ dùng → xoá khỏi CSDL thay vì lưu chuỗi rỗng.
      const entries = Array.from(dirty.current);
      const clear = entries.filter(([k, v]) => TRACKING_KEYS.includes(k) && v === "").map(([k]) => k);
      const items = entries.filter(([k]) => !clear.includes(k)).map(([key, value]) => ({ key, value }));
      if (items.length > 0) {
        const res = await fetch("/api/website/texts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) {
          setMsg(await errorMessage(res, "Lưu không thành công"));
          return;
        }
      }
      for (const key of clear) {
        await fetch(`/api/website/texts/${encodeURIComponent(key)}`, { method: "DELETE" });
      }
      await refreshAndReload(goTo);
    } catch {
      setMsg("Không kết nối được máy chủ, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  /** Xoá bản đã sửa của các mã (về bản gốc) rồi tải lại trang. Chỗ khác chưa lưu sẽ mất → hỏi trước. */
  async function resetKeys(keys: string[], what: string) {
    const others = Array.from(dirty.current.keys()).filter((k) => !keys.includes(k));
    const warn = others.length > 0 ? `\n\nLưu ý: ${others.length} chỗ khác chưa lưu sẽ bị bỏ.` : "";
    if (!window.confirm(`Đưa ${what} về bản gốc ban đầu?${warn}`)) return;
    setBusy(true);
    try {
      for (const key of keys) {
        const res = await fetch(`/api/website/texts/${encodeURIComponent(key)}`, { method: "DELETE" });
        if (!res.ok) {
          setMsg(await errorMessage(res, "Không đưa về bản gốc được"));
          return;
        }
      }
      await refreshAndReload();
    } catch {
      setMsg("Không kết nối được máy chủ, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  function resetSelected() {
    if (!sel) {
      setMsg("Bấm vào đoạn chữ hoặc ảnh muốn đưa về bản gốc trước.");
      return;
    }
    if (sel.kind === "text")
      void resetKeys([sel.key, sel.key + STYLE_SUFFIX, sel.key + HREF_SUFFIX, sel.key + BTN_SUFFIX], "chữ, kiểu chữ, đường dẫn và kiểu nút của đoạn đang chọn");
    else void resetKeys([sel.key, sel.key + STYLE_SUFFIX], "ảnh đang chọn");
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
  const tool = "grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm transition-colors hover:bg-white/20 disabled:opacity-40";
  const on = "bg-white/25 text-orange-300";
  const group = "flex flex-wrap items-center gap-1 rounded-xl bg-white/5 p-1";
  // Giữ con trỏ trong đoạn chữ khi bấm nút công cụ.
  const keepFocus = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
  };

  const ts = textStyle();
  const is = imageStyle();
  const bs = blockStyle();
  const link = linkEl();
  const blockHidden = block?.dataset.secHidden !== undefined;
  const isHeroBlock = block?.dataset.sec === "hero";
  const custom = editing ? selectedCustom() : null;
  const field = "w-full rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-400";
  const canUndo = hist.past > 0;
  const canRedo = hist.future > 0;

  return (
    <>
      {listModal && (
        <ListEditor name={listModal.name} initial={listModal.rows} upload={uploadFile} onClose={() => setListModal(null)} onApply={applyList} />
      )}
      {preview && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/70 p-4" onClick={() => setPreview(null)}>
          <iframe src={preview} title="Xem thử trên điện thoại" className="preview-frame" onClick={(e) => e.stopPropagation()} />
          <p className="text-center text-xs text-white">
            Đây là bản <b>đã lưu</b> — chỗ vừa sửa chưa lưu sẽ không hiện. Bấm ra ngoài để đóng.
          </p>
        </div>
      )}
      <div
        ref={root}
        className="fixed bottom-20 left-4 z-50 max-h-[75vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl bg-ink p-2 text-white shadow-2xl sm:bottom-4 sm:max-w-[min(48rem,calc(100vw-6rem))]"
      >
        {editing && panel === "site" && (
          <div className="mb-2 space-y-3 rounded-xl bg-white/5 p-3 text-sm">
            <p className="font-semibold">Cài đặt chung (cả trang web)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                [
                  ["brand", "Màu chủ đạo"],
                  ["royal", "Màu phụ"],
                  ["ink", "Màu nền tối"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="color" value={themeVals[k]} onChange={(e) => setTheme({ [k]: e.target.value })} className="h-8 w-10 cursor-pointer rounded bg-transparent" />
                  <span className="text-xs">
                    {label}
                    {themeVals[k] !== THEME_DEFAULTS[k] && (
                      <button type="button" className="ml-1 text-orange-300 underline" onClick={() => setTheme({ [k]: THEME_DEFAULTS[k] })}>
                        gốc
                      </button>
                    )}
                  </span>
                </label>
              ))}
              <label className="text-xs">
                Font chữ
                <select value={themeVals.font} onChange={(e) => setTheme({ font: e.target.value })} className={field}>
                  {FONTS.map((f) => (
                    <option key={f.key} value={f.key} className="text-ink">
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs sm:col-span-2">
                Cỡ chữ cả trang: {themeVals.scale}%
                <input
                  type="range"
                  min={SCALE_MIN}
                  max={SCALE_MAX}
                  step={5}
                  value={themeVals.scale}
                  onChange={(e) => setTheme({ scale: Number(e.target.value) })}
                  className="block w-full"
                />
              </label>
            </div>

            <p className="pt-1 font-semibold">Thông tin liên hệ</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["hotline", "Hotline (chỉ số)"],
                  ["zalo", "Zalo (số điện thoại)"],
                  ["email", "Email"],
                  ["address", "Địa chỉ"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="text-xs">
                  {label}
                  <input value={siteVals[k]} onChange={(e) => setSite(k, e.target.value)} className={field} />
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Dùng ở nút Gọi, Zalo, menu trên, chân trang và trang Liên hệ.{" "}
              <button
                type="button"
                className="text-orange-300 underline"
                onClick={() => void resetKeys(["site.hotline", "site.zalo", "site.email", "site.address"], "thông tin liên hệ")}
              >
                Đưa về gốc
              </button>
            </p>

            <p className="pt-1 font-semibold">Mã theo dõi quảng cáo (để trống = không dùng)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs">
                Facebook Pixel ID
                <input value={siteVals.fb_pixel} onChange={(e) => setSite("fb_pixel", e.target.value)} placeholder="vd 123456789012345" className={field} />
              </label>
              <label className="text-xs">
                Google Analytics (GA4)
                <input value={siteVals.ga4} onChange={(e) => setSite("ga4", e.target.value)} placeholder="vd G-ABC123XYZ" className={field} />
              </label>
              <label className="text-xs">
                Khung chat Zalo OA (OA ID)
                <input value={siteVals.zalo_oa} onChange={(e) => setSite("zalo_oa", e.target.value)} placeholder="dãy số OA ID" className={field} />
              </label>
            </div>

            <p className="pt-1 font-semibold">Ảnh khi gửi link lên Facebook / Zalo</p>
            <div className="flex flex-wrap items-center gap-3">
              {siteVals.og_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api${siteVals.og_image}`} alt="Ảnh chia sẻ" className="h-16 w-28 rounded-lg object-cover" />
              ) : (
                <span className="text-xs text-slate-400">Chưa chọn ảnh (nên dùng ảnh ngang 1200×630).</span>
              )}
              <button type="button" className={`${btn} bg-white/10 hover:bg-white/20`} disabled={busy} onClick={() => pickFile("og")}>
                <ImageUp className="h-4 w-4" /> Chọn ảnh
              </button>
              {site.og_image && (
                <button type="button" className="text-xs text-orange-300 underline" onClick={() => void resetKeys(["site.og_image"], "ảnh chia sẻ")}>
                  Bỏ ảnh
                </button>
              )}
            </div>
          </div>
        )}

        {editing && panel === "page" && (
          <div className="mb-2 space-y-2 rounded-xl bg-white/5 p-3 text-sm">
            {seo ? (
              <>
                <p className="font-semibold">Trang này — hiện trên Google</p>
                <label className="block text-xs">
                  Tiêu đề ({seo.title.length}/120)
                  <input
                    value={seo.title}
                    maxLength={120}
                    onChange={(e) => {
                      setSeo({ ...seo, title: e.target.value });
                      markDirty(`seo.${seo.page}.title`, e.target.value.trim());
                    }}
                    className={field}
                  />
                </label>
                <label className="block text-xs">
                  Mô tả ({seo.desc.length}/300)
                  <textarea
                    value={seo.desc}
                    maxLength={300}
                    rows={3}
                    onChange={(e) => {
                      setSeo({ ...seo, desc: e.target.value });
                      markDirty(`seo.${seo.page}.desc`, e.target.value.trim());
                    }}
                    className={field}
                  />
                </label>
                <div className="flex flex-wrap gap-3 text-xs">
                  {(seo.title !== seo.titleDefault || seo.desc !== seo.descDefault) && (
                    <button
                      type="button"
                      className="text-orange-300 underline"
                      onClick={() => void resetKeys([`seo.${seo.page}.title`, `seo.${seo.page}.desc`], "tiêu đề và mô tả Google")}
                    >
                      Tiêu đề/mô tả về gốc
                    </button>
                  )}
                  <button type="button" className="text-orange-300 underline" onClick={() => void resetKeys([`layout.${seo.page}`], "thứ tự và ẩn/hiện các khối của trang này")}>
                    Bố cục trang về gốc (thứ tự, khối đã ẩn)
                  </button>
                </div>
                {seo.page.startsWith("p-") &&
                  (() => {
                    const slug = seo.page.slice(2);
                    const cp = pages.find((p) => p.slug === slug);
                    return (
                      cp && (
                        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-2 text-xs">
                          <span>Trang tự thêm: /{slug}</span>
                          <label className="flex items-center gap-1.5">
                            <input type="checkbox" checked={cp.menu} onChange={(e) => updatePage(slug, { menu: e.target.checked })} />
                            Hiện trên menu
                          </label>
                          <button type="button" className="flex items-center gap-1 text-red-300 underline" onClick={() => updatePage(slug, null)}>
                            <Trash2 className="h-3.5 w-3.5" /> Xoá trang
                          </button>
                        </div>
                      )
                    );
                  })()}
              </>
            ) : (
              <p className="text-xs text-slate-400">Trang này không có cài đặt riêng.</p>
            )}
            <div className="border-t border-white/10 pt-2">
              <button type="button" className={`${btn} bg-white/10 hover:bg-white/20`} onClick={addPage}>
                <SquarePlus className="h-4 w-4" /> Thêm trang mới
              </button>
              {pages.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  Trang đã thêm:{" "}
                  {pages.map((p, i) => (
                    <span key={p.slug}>
                      {i > 0 && " · "}
                      <a href={`/${p.slug}`} className="text-orange-300 underline">
                        {p.title}
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        )}

        {editing && sel?.kind === "text" && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5" onMouseDown={keepFocus}>
            <div className={group}>
              <button type="button" className={tool} title="Chữ nhỏ hơn" onClick={() => changeSize(-1)}>
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-11 text-center text-xs tabular-nums">{Math.round((ts.size ?? 1) * 100)}%</span>
              <button type="button" className={tool} title="Chữ to hơn" onClick={() => changeSize(1)}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className={group}>
              {COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  title={c.label}
                  onClick={() => updateText({ color: c.value })}
                  className={`h-6 w-6 rounded-full border-2 ${ts.color === c.value ? "border-orange-300" : "border-white/20"}`}
                  style={c.value ? { background: c.value } : { background: "linear-gradient(135deg,#fff 45%,#dc2626 45%,#dc2626 55%,#fff 55%)" }}
                />
              ))}
              <input
                type="color"
                title="Màu khác"
                value={ts.color ?? "#000000"}
                onChange={(e) => updateText({ color: e.target.value })}
                className="h-7 w-8 cursor-pointer rounded bg-transparent"
              />
            </div>
            <div className={group}>
              <button type="button" className={`${tool} ${ts.b ? on : ""}`} title="Chữ đậm" onClick={() => toggleFlag("b")}>
                <Bold className="h-4 w-4" />
              </button>
              <button type="button" className={`${tool} ${ts.i ? on : ""}`} title="Chữ nghiêng" onClick={() => toggleFlag("i")}>
                <Italic className="h-4 w-4" />
              </button>
              <button type="button" className={`${tool} ${ts.u ? on : ""}`} title="Gạch chân" onClick={() => toggleFlag("u")}>
                <Underline className="h-4 w-4" />
              </button>
            </div>
            <div className={group}>
              {(
                [
                  ["left", AlignLeft, "Căn trái"],
                  ["center", AlignCenter, "Căn giữa"],
                  ["right", AlignRight, "Căn phải"],
                ] as const
              ).map(([a, Icon, label]) => (
                <button
                  key={a}
                  type="button"
                  className={`${tool} ${ts.align === a ? on : ""}`}
                  title={label}
                  onClick={() => updateText({ align: ts.align === a ? undefined : a })}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div className={group}>
              <button type="button" className={`${tool} ${ts.hidden ? on : ""}`} title={ts.hidden ? "Hiện lại đoạn chữ" : "Ẩn đoạn chữ"} onClick={() => updateText({ hidden: !ts.hidden })}>
                {ts.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            {link && (
              <div className={group}>
                <button type="button" className={tool} title="Đổi đường dẫn của nút" onClick={changeLink}>
                  <Link2 className="h-4 w-4" />
                </button>
                {(Object.keys(BUTTON_VARIANTS) as ButtonVariant[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    title={`Nút ${BTN_LABELS[v].toLowerCase()}`}
                    className={`${tool} text-xs ${link.dataset.btn === v ? on : ""}`}
                    onClick={() => changeButton(v)}
                  >
                    {BTN_LABELS[v]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {editing && sel?.kind === "image" && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <button type="button" className={`${btn} bg-white/10 hover:bg-white/20`} disabled={busy} onClick={() => pickFile("image")}>
              <ImageUp className="h-4 w-4" /> Đổi ảnh
            </button>
            <div className={group}>
              <button type="button" className={tool} title={(is.fit ?? "cover") === "contain" ? "Lấp đầy khung (cắt bớt)" : "Vừa khung (không cắt)"} onClick={toggleFit}>
                {(is.fit ?? "cover") === "contain" ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </button>
            </div>
            <div className={group} title="Dời phần ảnh hiện trong khung">
              <button type="button" className={tool} title="Dời sang trái" onClick={() => moveImage(-10, 0)}>
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" className={tool} title="Dời lên" onClick={() => moveImage(0, -10)}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className={tool} title="Dời xuống" onClick={() => moveImage(0, 10)}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" className={tool} title="Dời sang phải" onClick={() => moveImage(10, 0)}>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className={group}>
              <button type="button" className={tool} title="Thu nhỏ" onClick={() => zoomImage(-1)}>
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-11 text-center text-xs tabular-nums">{Math.round((is.zoom ?? 1) * 100)}%</span>
              <button type="button" className={tool} title="Phóng to" onClick={() => zoomImage(1)}>
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {editing && block && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="px-1 text-xs text-sky-300">Khối “{block.dataset.secLabel}”</span>
            <div className={group}>
              <button type="button" className={tool} title="Đưa khối lên trên" disabled={!(block.previousElementSibling as HTMLElement | null)?.dataset?.sec} onClick={() => moveBlock(-1)}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className={tool} title="Đưa khối xuống dưới" disabled={!(block.nextElementSibling as HTMLElement | null)?.dataset?.sec} onClick={() => moveBlock(1)}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" className={`${tool} ${blockHidden ? on : ""}`} title={blockHidden ? "Hiện lại khối" : "Ẩn khối"} onClick={toggleBlock}>
                {blockHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <div className={group} title="Nền khối">
              <button
                type="button"
                title="Nền gốc"
                onClick={() => updateBlock({ bg: undefined, img: undefined, dim: undefined })}
                className={`h-6 w-6 rounded-full border-2 ${!bs.bg && !bs.img ? "border-orange-300" : "border-white/20"}`}
                style={{ background: "linear-gradient(135deg,#fff 45%,#dc2626 45%,#dc2626 55%,#fff 55%)" }}
              />
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={`Nền ${c}`}
                  onClick={() => updateBlock({ bg: c, img: undefined, dim: undefined })}
                  className={`h-6 w-6 rounded-full border-2 ${bs.bg === c ? "border-orange-300" : "border-white/20"}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                title="Màu nền khác"
                value={bs.bg ?? "#ffffff"}
                onChange={(e) => updateBlock({ bg: e.target.value, img: undefined, dim: undefined })}
                className="h-7 w-8 cursor-pointer rounded bg-transparent"
              />
              <button type="button" className={tool} title="Ảnh nền" disabled={busy} onClick={() => pickFile("block")}>
                <ImageUp className="h-4 w-4" />
              </button>
              {bs.img && (
                <button type="button" className={`${tool} text-xs ${bs.dim ? on : ""}`} title="Phủ tối ảnh nền để chữ trắng dễ đọc" onClick={() => updateBlock({ dim: !bs.dim })}>
                  Phủ tối
                </button>
              )}
            </div>
            {!isHeroBlock && (
              <div className={group} title="Khoảng cách trên/dưới của khối">
                {PADS.map((p) => (
                  <button key={p.label} type="button" className={`${tool} text-xs ${bs.pad === p.value ? on : ""}`} onClick={() => updateBlock({ pad: p.value })}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            {custom && (
              <div className={group} title="Cấu hình khối tự thêm">
                {custom.type === "text-image" && (
                  <button type="button" className={`${tool} text-xs`} onClick={() => updateCustom({ right: !custom.right })}>
                    Ảnh {custom.right ? "← trái" : "→ phải"}
                  </button>
                )}
                {custom.type === "faq" && (
                  <>
                    <button type="button" className={tool} title="Bớt 1 câu hỏi" disabled={(custom.n ?? 3) <= 1} onClick={() => updateCustom({ n: (custom.n ?? 3) - 1 })}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-1 text-xs">{custom.n ?? 3} câu</span>
                    <button type="button" className={tool} title="Thêm 1 câu hỏi" disabled={(custom.n ?? 3) >= 20} onClick={() => updateCustom({ n: (custom.n ?? 3) + 1 })}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </>
                )}
                {custom.type === "video" && (
                  <button type="button" className={`${tool} text-xs`} onClick={setVideo}>
                    Video YouTube
                  </button>
                )}
                {custom.type === "form" && (
                  <button type="button" className={`${tool} text-xs`} onClick={() => updateCustom({ form: custom.form === "business" ? "worker" : "business" })}>
                    Form: {custom.form === "business" ? "doanh nghiệp" : "người lao động"} (đổi)
                  </button>
                )}
                <button type="button" className={`${tool} text-red-300`} title="Xoá khối này" onClick={deleteCustom}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="relative">
              <button type="button" className={`${tool} gap-1 bg-white/10 px-2.5 text-xs`} onClick={() => setAddMenu(!addMenu)}>
                <SquarePlus className="h-4 w-4" /> Thêm khối bên dưới
              </button>
              {addMenu && (
                <div className="absolute bottom-full left-0 z-10 mb-1 grid w-56 gap-0.5 rounded-xl bg-ink-2 p-1.5 shadow-xl ring-1 ring-white/10">
                  {(Object.keys(BLOCK_TYPES) as BlockType[]).map((t) => (
                    <button key={t} type="button" className="rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-white/15" onClick={() => addBlock(t)}>
                      {BLOCK_TYPES[t].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {editing && listBox && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="px-1 text-xs text-emerald-300">Danh sách “{listBox.el().dataset.listLabel}”</span>
            <button type="button" className={`${tool} gap-1 bg-white/10 px-2.5 text-xs`} onClick={openListEditor}>
              <LayoutList className="h-4 w-4" /> Thêm / xoá / sắp xếp mục
            </button>
          </div>
        )}

        {editing && panel === "history" && <HistoryPanel onRestored={() => void refreshAndReload()} />}

        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <span className="px-2 text-sm text-orange-300">
                Đang sửa{dirtyCount > 0 ? ` · ${dirtyCount} chỗ chưa lưu` : ""}
              </span>
              <button type="button" onClick={() => void save()} disabled={busy || dirtyCount === 0} className={`${btn} bg-brand hover:bg-brand-dark`}>
                <Check className="h-4 w-4" aria-hidden="true" /> Lưu
              </button>
              <div className="flex gap-1">
                <button type="button" onClick={undo} disabled={!canUndo} className={`${btn} bg-white/10 px-2.5 hover:bg-white/20`} title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác">
                  <Undo2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={redo} disabled={!canRedo} className={`${btn} bg-white/10 px-2.5 hover:bg-white/20`} title="Làm lại (Ctrl+Y)" aria-label="Làm lại">
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={resetSelected} disabled={busy || !sel} className={`${btn} bg-white/10 hover:bg-white/20`}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Về bản gốc
              </button>
              <button type="button" onClick={() => setPanel(panel === "site" ? null : "site")} className={`${btn} ${panel === "site" ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>
                <Settings className="h-4 w-4" aria-hidden="true" /> Cài đặt chung
              </button>
              <button type="button" onClick={openPage} className={`${btn} ${panel === "page" ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>
                <FileText className="h-4 w-4" aria-hidden="true" /> Trang này
              </button>
              <button type="button" onClick={() => setPreview(window.location.pathname)} className={`${btn} bg-white/10 hover:bg-white/20`} title="Xem thử trên điện thoại">
                <Smartphone className="h-4 w-4" aria-hidden="true" /> Điện thoại
              </button>
              <button type="button" onClick={() => setPanel(panel === "history" ? null : "history")} className={`${btn} ${panel === "history" ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>
                <History className="h-4 w-4" aria-hidden="true" /> Lịch sử
              </button>
              <button
                type="button"
                onClick={() => {
                  // Tải trang mới (không chuyển trang kiểu SPA) để trình duyệt hỏi nếu còn chỗ chưa lưu.
                  window.location.href = "/quan-ly";
                }}
                className={`${btn} bg-white/10 hover:bg-white/20`}
                title="Đăng / sửa tin việc làm, tin tức, album"
              >
                <Newspaper className="h-4 w-4" aria-hidden="true" /> Quản lý tin
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
        {editing && (
          <p className="px-2 pt-1.5 text-xs text-slate-400">
            Bấm chữ để gõ sửa và chỉnh kiểu · bấm ảnh để đổi/chỉnh ảnh · bấm vùng trống của khối để đổi vị trí, nền, khoảng cách
          </p>
        )}
        {msg && <p className="px-2 pt-2 text-xs text-red-300">{msg}</p>}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(file);
          }}
        />
      </div>
    </>
  );
}

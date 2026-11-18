import { areas, businessSteps, businessValues, partners, stats, workerSteps, worries } from "./content";
import { isUploadUrl } from "./style";

/**
 * Danh sách thêm/xoá/sắp xếp được ở chế độ sửa (2026-11-18). Lưu ở mã `list.<tên>` trong website_texts:
 *   [{ id, f?: { trường: giá trị } }]   — thứ tự mảng = thứ tự hiện.
 * Mục gốc giữ id cũ (0,1,2… hoặc key) nên chữ đã sửa trước đây (vd stats.0.label) vẫn giữ.
 * Trường "inline" sửa bằng cách gõ thẳng trên trang (mã chữ = textKey); trường khác sửa trong bảng "Sửa danh sách".
 * File này dùng chung cho máy chủ và thanh sửa — không import gì của máy chủ.
 */

export type FieldKind = "text" | "number" | "image";
export type FieldDef = { key: string; label: string; kind: FieldKind; inline: boolean; placeholder: string };
export type ListDef = {
  label: string;
  fields: FieldDef[];
  /** Mã chữ sửa tại chỗ của một trường inline. */
  textKey: (id: string, field: string) => string;
  defaults: { id: string; f: Record<string, string> }[];
  max: number;
};

const inline = (key: string, label: string, placeholder: string): FieldDef => ({ key, label, kind: "text", inline: true, placeholder });

const steps = (prefix: string, src: { title: string; text: string }[]): Pick<ListDef, "fields" | "textKey" | "defaults"> => ({
  fields: [inline("title", "Tiêu đề", "Bước mới"), inline("text", "Mô tả", "Mô tả bước này")],
  textKey: (id, field) => `${prefix}.${id}.${field}`,
  defaults: src.map((s, i) => ({ id: String(i), f: { title: s.title, text: s.text } })),
});

export const LISTS = {
  "hero-points": {
    label: "Điểm nổi bật (đầu trang chủ)",
    fields: [inline("text", "Nội dung", "Điểm nổi bật mới")],
    textKey: (id: string) => `home.hero.point${id}`,
    defaults: ["Miễn phí 100% cho người lao động", "Không giữ giấy tờ gốc", "Báo rõ lương trước khi nhận việc"].map((t, i) => ({
      id: String(i + 1),
      f: { text: t },
    })),
    max: 8,
  },
  stats: {
    label: "Số liệu",
    fields: [
      { key: "value", label: "Con số", kind: "number", inline: false, placeholder: "0" },
      { key: "suffix", label: "Đơn vị sau số", kind: "text", inline: false, placeholder: "+" },
      inline("label", "Tên số liệu", "Số liệu mới"),
      inline("note", "Ghi chú", "Ghi chú"),
    ],
    textKey: (id: string, field: string) => `stats.${id}.${field}`,
    defaults: stats.map((s, i) => ({ id: String(i), f: { value: String(s.value), suffix: s.suffix, label: s.label, note: s.note } })),
    max: 8,
  },
  worries: {
    label: "Nỗi lo người lao động",
    fields: [inline("title", "Tiêu đề", "Nỗi lo mới"), inline("worry", "Nỗi lo", "Người lao động lo điều gì"), inline("answer", "Cách giải quyết", "Đại Việt giải quyết thế nào")],
    textKey: (id: string, field: string) => `worries.${id}.${field}`,
    defaults: worries.map((w) => ({ id: w.key, f: { title: w.title, worry: w.worry, answer: w.answer } })),
    max: 8,
  },
  areas: {
    label: "Khu công nghiệp",
    fields: [inline("name", "Tên KCN", "KCN mới"), inline("province", "Tỉnh", "Tỉnh")],
    textKey: (id: string, field: string) => `areas.${id}.${field}`,
    defaults: areas.map((a, i) => ({ id: String(i), f: { name: `KCN ${a.name}`, province: a.province } })),
    max: 12,
  },
  "steps-worker": { label: "Các bước (người lao động)", ...steps("steps.worker", workerSteps), max: 8 },
  "steps-business": { label: "Các bước (doanh nghiệp)", ...steps("steps.business", businessSteps), max: 8 },
  "business-values": {
    label: "Giá trị cho nhà máy",
    fields: [inline("title", "Tiêu đề", "Giá trị mới"), inline("text", "Mô tả", "Mô tả")],
    textKey: (id: string, field: string) => `business.values.${id}.${field}`,
    defaults: businessValues.map((v, i) => ({ id: String(i), f: { title: v.title, text: v.text } })),
    max: 8,
  },
  partners: {
    label: "Đối tác / khách hàng",
    fields: [
      { key: "name", label: "Tên đối tác", kind: "text", inline: false, placeholder: "TÊN ĐỐI TÁC" },
      { key: "logo", label: "Logo", kind: "image", inline: false, placeholder: "" },
      inline("note", "Ghi chú", "Lĩnh vực"),
    ],
    textKey: (id: string, field: string) => `partners.${id}.${field}`,
    defaults: partners.map((p) => ({ id: p.key, f: { name: p.name, logo: p.logo, note: p.note } })),
    max: 20,
  },
} satisfies Record<string, ListDef>;

export type ListName = keyof typeof LISTS;
export type ListItem = { id: string } & Record<string, string>;
export const isListName = (v: unknown): v is ListName => typeof v === "string" && v in LISTS;

const ID = /^[a-z0-9-]{1,20}$/;

/** Ảnh logo gốc (public/logos) hoặc ảnh đã tải lên. */
const isLogo = (v: string) => isUploadUrl(v) || /^\/logos\/[\w-]+\.(svg|png|jpg|webp)$/.test(v);

/** Gộp danh sách đã lưu với mục gốc. raw không hợp lệ → danh sách gốc. */
export function resolveList(name: ListName, raw: string | undefined): ListItem[] {
  const def: ListDef = LISTS[name];
  const byId = new Map(def.defaults.map((d) => [d.id, d.f]));
  let saved: { id: string; f?: Record<string, unknown> }[] | null = null;
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(v)) saved = v.filter((x) => x && typeof x === "object" && ID.test((x as { id: string }).id));
  } catch {
    saved = null;
  }
  const src = saved ?? def.defaults;
  const seen = new Set<string>();
  const out: ListItem[] = [];
  for (const s of src.slice(0, def.max)) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const base = byId.get(s.id) ?? {};
    const item: ListItem = { id: s.id };
    for (const fd of def.fields) {
      const v = (s.f ?? {})[fd.key];
      let val = typeof v === "string" ? v.slice(0, 500) : base[fd.key] ?? fd.placeholder;
      if (fd.kind === "number") val = /^\d{1,9}$/.test(val) ? val : "0";
      if (fd.kind === "image" && val && !isLogo(val)) val = base[fd.key] && isLogo(base[fd.key]) ? base[fd.key] : "";
      item[fd.key] = val;
    }
    out.push(item);
  }
  return out;
}

/** Mã ngẫu nhiên cho mục mới thêm. */
export const newItemId = () => `n${Math.random().toString(36).slice(2, 8)}`;

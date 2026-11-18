import type { CSSProperties, ReactNode } from "react";
import { getTexts } from "@/lib/texts";
import { getPageSeo, pageDefaults, type PageKey } from "@/lib/site";
import { blockStyleVars, parseBlockStyle, parseLayout } from "@/lib/style";
import { BLOCK_TYPES, parseCustomBlocks } from "@/lib/pages";
import { CustomBlockView } from "./custom-block";

export type Block = { id: string; label: string; node: ReactNode };

/**
 * Các khối của một trang — ở chế độ sửa đổi được thứ tự (lên/xuống), ẩn/hiện, nền, khoảng cách,
 * và thêm khối mới từ mẫu (mã custom.<trang>, lib/pages.ts).
 * Thứ tự lưu ở mã `layout.<trang>`; khối mới thêm vào code (chưa có trong thứ tự đã lưu) nằm đúng chỗ gốc,
 * khối thêm từ mẫu chưa có trong thứ tự thì nằm cuối trang.
 * Thẻ bọc mang tiêu đề/mô tả Google + danh sách khối thêm để thanh sửa đọc.
 */
export async function Blocks({ page, items: builtin }: { page: PageKey; items: Block[] }) {
  const texts = await getTexts();
  const layout = parseLayout(texts[`layout.${page}`]);
  const seo = await getPageSeo(page);
  const defaults = await pageDefaults(page);
  const customRaw = texts[`custom.${page}`];
  const custom = parseCustomBlocks(customRaw);
  const items: Block[] = [
    ...builtin,
    ...custom.map((c) => ({ id: c.id, label: BLOCK_TYPES[c.type].label, node: <CustomBlockView block={c} /> })),
  ];
  const byId = new Map(items.map((b) => [b.id, b]));
  const ordered: Block[] = [];
  for (const id of layout.order) {
    const b = byId.get(id);
    if (b) {
      ordered.push(b);
      byId.delete(id);
    }
  }
  // Khối chưa có trong thứ tự đã lưu: chèn sau khối đứng trước nó trong bản gốc.
  items.forEach((b, i) => {
    if (!byId.has(b.id)) return;
    const prev = items[i - 1];
    const at = prev ? ordered.findIndex((x) => x.id === prev.id) + 1 : 0;
    ordered.splice(at, 0, b);
  });
  const hidden = new Set(layout.hidden);
  return (
    <div
      data-blocks={page}
      data-seo-title={seo.title}
      data-seo-desc={seo.desc}
      data-seo-title-default={defaults.title}
      data-seo-desc-default={defaults.desc}
      data-custom={JSON.stringify(custom)}
    >
      {ordered.map((b) => {
        // Nền + khoảng cách riêng của khối (mã block.<trang>.<khối>).
        const raw = texts[`block.${page}.${b.id}`];
        const bs = parseBlockStyle(raw);
        return (
          <div
            key={b.id}
            data-sec={b.id}
            data-sec-label={b.label}
            data-sec-hidden={hidden.has(b.id) ? "" : undefined}
            data-block-style={raw ? JSON.stringify(bs) : undefined}
            data-bg={bs.bg || bs.img ? "" : undefined}
            data-pad={bs.pad ? "" : undefined}
            style={blockStyleVars(bs) as CSSProperties}
          >
            {b.node}
          </div>
        );
      })}
    </div>
  );
}

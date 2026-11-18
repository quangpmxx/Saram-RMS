import type { Metadata } from "next";
import { company as baseCompany } from "./content";
import { getTexts } from "./texts";
import { parsePages, type CustomPage } from "./pages";
import {
  SCALE_MAX,
  SCALE_MIN,
  THEME_DEFAULTS,
  fontVar,
  formatPhone,
  isEmail,
  isFontKey,
  isGa4Id,
  isHex,
  isPhone,
  isPixelId,
  isUploadUrl,
  isZaloOaId,
  themeVars,
  type Theme,
} from "./style";

/**
 * Cài đặt chung sửa tại chỗ (2026-11-17) — mã trong website_texts:
 *   site.hotline / site.zalo / site.email / site.address   thông tin liên hệ
 *   theme.brand / theme.royal / theme.ink / theme.scale     màu chủ đạo, màu phụ, màu nền tối, cỡ chữ toàn trang (%)
 *   seo.<trang>.title / seo.<trang>.desc                    tiêu đề + mô tả hiện trên Google
 *   theme.font                                              font chữ cả trang (FONTS trong lib/style.ts)
 *   site.fb_pixel / site.ga4 / site.zalo_oa                 mã theo dõi Facebook Pixel, Google Analytics, khung chat Zalo OA
 *   site.og_image                                           ảnh hiện khi gửi link lên Facebook/Zalo
 */

export type SiteInfo = {
  hotline: string;
  hotlineDisplay: string;
  zalo: string;
  email: string;
  address: string;
};

export async function getCompany() {
  const t = await getTexts();
  const hotline = isPhone(t["site.hotline"]) ? t["site.hotline"] : baseCompany.hotline;
  const address = (t["site.address"] ?? "").trim();
  return {
    ...baseCompany,
    hotline,
    hotlineDisplay: hotline === baseCompany.hotline ? baseCompany.hotlineDisplay : formatPhone(hotline),
    zalo: isPhone(t["site.zalo"]) ? t["site.zalo"] : baseCompany.zalo,
    email: isEmail(t["site.email"]) ? t["site.email"] : baseCompany.email,
    address: address && address.length <= 300 ? address : baseCompany.address,
  };
}

export async function getTheme(): Promise<Theme> {
  const t = await getTexts();
  const scale = Number(t["theme.scale"]);
  return {
    brand: isHex(t["theme.brand"]) ? t["theme.brand"] : THEME_DEFAULTS.brand,
    royal: isHex(t["theme.royal"]) ? t["theme.royal"] : THEME_DEFAULTS.royal,
    ink: isHex(t["theme.ink"]) ? t["theme.ink"] : THEME_DEFAULTS.ink,
    scale: Number.isInteger(scale) && scale >= SCALE_MIN && scale <= SCALE_MAX ? scale : THEME_DEFAULTS.scale,
    font: isFontKey(t["theme.font"]) ? t["theme.font"] : THEME_DEFAULTS.font,
  };
}

/** CSS chèn vào <head> — chỉ gồm giá trị đã kiểm (mã màu #rrggbb, số nguyên). */
export function themeCss(th: Theme): string {
  const same = th.brand === THEME_DEFAULTS.brand && th.royal === THEME_DEFAULTS.royal && th.ink === THEME_DEFAULTS.ink;
  const vars = same ? "" : Object.entries(themeVars(th)).map(([k, v]) => `${k}:${v};`).join("");
  const scale = th.scale !== 100 ? `font-size:${th.scale}%;` : "";
  const font = th.font !== THEME_DEFAULTS.font && isFontKey(th.font) ? `--font-pick:var(${fontVar(th.font)});` : "";
  return vars || scale || font ? `:root{${vars}${scale}${font}}` : "";
}

/** Trang có sẵn trong code. Trang tự thêm ở chế độ sửa có mã "p-<đường dẫn>" (lib/pages.ts). */
export type BuiltinPage = "home" | "jobs" | "worker" | "business" | "about" | "contact" | "news";
export type PageKey = BuiltinPage | `p-${string}`;

export const PAGE_META: Record<BuiltinPage, { title: string; desc: string }> = {
  news: {
    title: "Tin tức & hình ảnh",
    desc: "Tin tuyển dụng, hoạt động và hình ảnh ký túc xá, người lao động của Đại Việt tại các KCN Bắc Ninh, Bắc Giang.",
  },
  home: {
    title: "SARAM VINA - ĐẠI VIỆT",
    desc: "Đại Việt cung ứng nhân lực cho nhà máy tại các KCN Bắc Ninh, Bắc Giang từ năm 2016. Người lao động có ký túc xá sát nhà máy, mượn xe điện miễn phí, chỉ cần CCCD.",
  },
  jobs: {
    title: "Việc làm KCN Bắc Ninh, Bắc Giang",
    desc: "Việc làm nhà máy đang tuyển tại KCN Quế Võ, VSIP, Nam Sơn – Hạp Lĩnh, Quang Châu. Có ký túc xá, mượn xe điện miễn phí.",
  },
  worker: {
    title: "Quyền lợi người lao động",
    desc: "Đi làm qua Đại Việt: ký túc xá sát KCN, mượn xe điện miễn phí, chỉ cần CCCD, phụ cấp 30.000–70.000đ mỗi công.",
  },
  business: {
    title: "Giải pháp cung ứng nhân lực cho nhà máy",
    desc: "Đại Việt cung ứng lao động cho nhà máy tại KCN Bắc Ninh, Bắc Giang: đủ quân số, đúng tiến độ, có ký túc xá và xe đi lại cho lao động.",
  },
  about: {
    title: "Về Đại Việt",
    desc: `${baseCompany.legalName} — gần 10 năm cung ứng nhân lực cho các KCN trọng điểm tại Bắc Ninh, Bắc Giang.`,
  },
  contact: {
    title: "Liên hệ",
    desc: "Liên hệ Đại Việt để tìm việc làm hoặc trao đổi nhu cầu tuyển dụng cho nhà máy.",
  },
};

const clean = (v: string | undefined, max: number) => {
  const s = (v ?? "").trim();
  return s && s.length <= max ? s : undefined;
};

/** Trang tự thêm ở chế độ sửa (mã "pages"). */
export async function getCustomPages(): Promise<CustomPage[]> {
  return parsePages((await getTexts())["pages"]);
}

/** Tiêu đề/mô tả gốc của trang (trang tự thêm: lấy tên trang). */
export async function pageDefaults(page: PageKey): Promise<{ title: string; desc: string }> {
  if (!page.startsWith("p-")) return PAGE_META[page as BuiltinPage];
  const custom = (await getCustomPages()).find((p) => `p-${p.slug}` === page);
  const title = custom?.title ?? "Trang";
  return { title, desc: `${title} — SARAM VINA - ĐẠI VIỆT, cung ứng nhân lực KCN Bắc Ninh, Bắc Giang.` };
}

export async function getPageSeo(page: PageKey) {
  const t = await getTexts();
  const def = await pageDefaults(page);
  return {
    title: clean(t[`seo.${page}.title`], 120) ?? def.title,
    desc: clean(t[`seo.${page}.desc`], 300) ?? def.desc,
  };
}

export async function pageMetadata(page: PageKey): Promise<Metadata> {
  const seo = await getPageSeo(page);
  return {
    // Trang chủ: tiêu đề đứng một mình; trang con: "Tiêu đề · SARAM VINA - ĐẠI VIỆT" (mẫu ở layout).
    title: page === "home" ? { absolute: seo.title } : seo.title,
    description: seo.desc,
  };
}

/** Mã theo dõi + ảnh chia sẻ — chỉ trả giá trị đúng định dạng. */
export async function getTracking() {
  const t = await getTexts();
  return {
    fbPixel: isPixelId(t["site.fb_pixel"]) ? t["site.fb_pixel"] : "",
    ga4: isGa4Id(t["site.ga4"]) ? t["site.ga4"] : "",
    zaloOa: isZaloOaId(t["site.zalo_oa"]) ? t["site.zalo_oa"] : "",
    ogImage: isUploadUrl(t["site.og_image"]) ? t["site.og_image"] : "",
  };
}

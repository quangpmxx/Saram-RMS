/**
 * Sinh app/dark-theme.css — giao diện Tối (yêu cầu người dùng 2026-10-29).
 *
 * Cách làm: KHÔNG sửa từng component. Quét mọi class màu đang dùng trong
 * app/ components/ lib/ rồi sinh luật ghi đè dưới `html.dark`:
 * - slate: đảo thang màu bằng biến CSS (utility Tailwind dùng var()).
 * - bg-white, nền nhạt màu (-50/-100/-200), viền nhạt: đổi sang nền tối/tông pha.
 * - chữ màu đậm (-600…-950): đổi sang sắc nhạt để đọc được trên nền tối.
 * Luật nằm NGOÀI @layer nên luôn thắng utility của Tailwind.
 * Màu trên sidebar (brand-100/200 nhạt trên nền xanh thẫm) không bị đụng tới.
 *
 * Chạy lại sau khi thêm class màu mới: node scripts/generate-dark-theme.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["app", "components", "lib"];
const OUTPUT = path.join(ROOT, "app", "dark-theme.css");

/** Nền thẻ/khung (thay bg-white) và nền trang. */
const SURFACE = "#111a2b";
const PAGE = "#0b1120";

/** Sắc 200/300/400/500 của từng họ màu (bảng màu Tailwind + brand/accent của dự án). */
const PALETTE = {
  red: ["#fecaca", "#fca5a5", "#f87171", "#ef4444"],
  orange: ["#fed7aa", "#fdba74", "#fb923c", "#f97316"],
  amber: ["#fde68a", "#fcd34d", "#fbbf24", "#f59e0b"],
  yellow: ["#fef08a", "#fde047", "#facc15", "#eab308"],
  lime: ["#d9f99d", "#bef264", "#a3e635", "#84cc16"],
  green: ["#bbf7d0", "#86efac", "#4ade80", "#22c55e"],
  emerald: ["#a7f3d0", "#6ee7b7", "#34d399", "#10b981"],
  teal: ["#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6"],
  cyan: ["#a5f3fc", "#67e8f9", "#22d3ee", "#06b6d4"],
  sky: ["#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9"],
  blue: ["#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6"],
  indigo: ["#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1"],
  violet: ["#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6"],
  purple: ["#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7"],
  fuchsia: ["#f5d0fe", "#f0abfc", "#e879f9", "#d946ef"],
  pink: ["#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899"],
  rose: ["#fecdd3", "#fda4af", "#fb7185", "#f43f5e"],
  brand: ["#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6"],
  accent: ["#fed7aa", "#fdba74", "#fb923c", "#f97316"],
};
const FAMILIES = Object.keys(PALETTE);

/** Thang slate đảo cho nền tối (50 tối nhất … 950 sáng nhất). */
const SLATE_DARK = {
  50: PAGE,
  100: "#1a2436",
  200: "#263247",
  300: "#3b4a63",
  400: "#7a8aa3",
  500: "#94a3b8",
  600: "#b4c0d0",
  700: "#cbd5e1",
  800: "#e2e8f0",
  900: "#f1f5f9",
  950: "#f8fafc",
};

const RESPONSIVE = { sm: "40rem", md: "48rem", lg: "64rem", xl: "80rem", "2xl": "96rem" };
const PSEUDO = {
  hover: ":hover",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  "focus-within": ":focus-within",
  active: ":active",
  disabled: ":disabled",
  even: ":nth-child(2n)",
  odd: ":nth-child(odd)",
  placeholder: "::placeholder",
};

const mix = (color, percent, base = SURFACE) => `color-mix(in srgb, ${color} ${percent}%, ${base})`;
const withAlpha = (value, alpha) => (alpha === null ? value : `color-mix(in srgb, ${value} ${alpha}%, transparent)`);

/** Giá trị màu tối cho 1 utility, hoặc null nếu không cần đổi. */
function darkValue(prop, color, shade, alpha) {
  if (color === "white") {
    // bg-white/5…/20 là lớp phủ mờ trên sidebar tối — giữ nguyên.
    if (prop !== "bg" || (alpha !== null && alpha <= 20)) return null;
    return { css: "background-color", value: withAlpha(SURFACE, alpha) };
  }
  if (!PALETTE[color]) return null;
  const [c200, c300, c400, c500] = PALETTE[color];
  if (prop === "bg") {
    const pct = { 50: 12, 100: 20, 200: 30 }[shade];
    return pct ? { css: "background-color", value: withAlpha(mix(c500, pct), alpha) } : null;
  }
  if (prop === "border" || prop === "ring" || prop === "divide") {
    const pct = { 50: 20, 100: 28, 200: 36, 300: 48 }[shade];
    if (!pct) return null;
    const css = prop === "ring" ? "--tw-ring-color" : "border-color";
    return { css, value: withAlpha(mix(c500, pct), alpha) };
  }
  if (prop === "text") {
    const value = { 600: c400, 700: c300, 800: c300, 900: c200, 950: c200 }[shade];
    return value ? { css: "color", value: withAlpha(value, alpha) } : null;
  }
  return null;
}

const TOKEN = new RegExp(
  String.raw`(?<![\w-])((?:[a-z0-9-]+:)*)(bg|text|border|ring|divide)-(white|${FAMILIES.join("|")})(?:-(\d{2,3}))?(?:\/(\d{1,3}))?(?![\w/-])`,
  "g",
);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const escapeClass = (cls) => cls.replace(/[:/[\].]/g, (ch) => `\\${ch}`);

const rules = new Map();
const skipped = new Set();
for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const source = fs.readFileSync(file, "utf8");
    for (const m of source.matchAll(TOKEN)) {
      const [, variantChain, prop, color, shadeRaw, alphaRaw] = m;
      if (color !== "white" && !shadeRaw) continue;
      const shade = shadeRaw ? Number(shadeRaw) : null;
      const alpha = alphaRaw ? Number(alphaRaw) : null;
      const dark = darkValue(prop, color, shade, alpha);
      if (!dark) continue;

      const variants = variantChain ? variantChain.slice(0, -1).split(":") : [];
      let media = null;
      let pseudo = "";
      let groupHover = false;
      let ok = true;
      for (const v of variants) {
        if (RESPONSIVE[v]) media = RESPONSIVE[v];
        else if (v === "group-hover") groupHover = true;
        else if (PSEUDO[v] !== undefined) pseudo += PSEUDO[v];
        else ok = false;
      }
      const className = `${variantChain}${prop}-${color}${shadeRaw ? `-${shadeRaw}` : ""}${alphaRaw ? `/${alphaRaw}` : ""}`;
      if (!ok) {
        skipped.add(className);
        continue;
      }
      let target = `.${escapeClass(className)}${pseudo}`;
      if (prop === "divide") target = `${target} > :not(:last-child)`;
      const selector = groupHover ? `html.dark .group:hover ${target}` : `html.dark ${target}`;
      const decl = `${dark.css}: ${dark.value};`;
      rules.set(selector, { media, decl });
    }
  }
}

const plain = [];
const byMedia = new Map();
for (const [selector, { media, decl }] of [...rules.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const line = `${selector} { ${decl} }`;
  if (media) {
    if (!byMedia.has(media)) byMedia.set(media, []);
    byMedia.get(media).push(line);
  } else plain.push(line);
}

const slateVars = Object.entries(SLATE_DARK)
  .map(([shade, hex]) => `  --color-slate-${shade}: ${hex};\n  --color-gray-${shade}: ${hex};`)
  .join("\n");

const css = `/*
 * TỰ SINH bởi scripts/generate-dark-theme.mjs — không sửa tay.
 * Giao diện Tối riêng từng tài khoản (yêu cầu người dùng 2026-10-29), bật
 * bằng class "dark" trên <html> (xem lib/ui-theme.tsx). Ngày sinh nhật luôn
 * dùng giao diện sinh nhật (sáng) nên class này bị gỡ trong ngày đó.
 */
html.dark {
  color-scheme: dark;
  --background: ${PAGE};
  --foreground: #e2e8f0;
${slateVars}
}
html.dark * {
  scrollbar-color: #3b4a63 transparent;
}
/* Nền tối dạng tooltip/lớp phủ: thang slate đã đảo nên giữ lại nền tối. */
html.dark .bg-slate-900 { background-color: #1e293b; }
html.dark .bg-slate-900\\/50 { background-color: rgb(2 6 23 / 0.6); }
html.dark .bg-slate-800 { background-color: #273449; }
/* Logo/ảnh nền trắng: giảm chói. */
html.dark img { filter: brightness(0.92); }

${plain.join("\n")}
${[...byMedia.entries()]
  .map(([media, lines]) => `@media (width >= ${media}) {\n${lines.map((l) => `  ${l}`).join("\n")}\n}`)
  .join("\n")}
`;

fs.writeFileSync(OUTPUT, css);
console.log(`Đã sinh ${path.relative(ROOT, OUTPUT)}: ${rules.size} luật.`);
if (skipped.size) console.log(`Bỏ qua (biến thể chưa hỗ trợ): ${[...skipped].sort().join(", ")}`);

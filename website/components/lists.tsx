import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Banknote, Bike, FileText, Flame, Home, MapPin, Wallet } from "lucide-react";
import { getList, listAttrs } from "@/lib/lists-server";
import { LISTS } from "@/lib/lists";
import { isUploadUrl } from "@/lib/style";
import type { Job } from "@/lib/content-api";
import { CountUp } from "./count-up";
import { T } from "./editable";

/**
 * Các danh sách thêm/xoá/sắp xếp được ở chế độ sửa (lib/lists.ts) — 2026-11-18.
 * Thẻ chứa mang data-list… để thanh sửa hiện nút "Sửa danh sách".
 */

const logoSrc = (v: string) => (isUploadUrl(v) ? `/api${v}` : v);

export async function HeroPoints() {
  const items = await getList("hero-points");
  const def = LISTS["hero-points"];
  return (
    <ul {...await listAttrs("hero-points", items)} className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-orange-400" aria-hidden="true" />
          <T k={def.textKey(it.id)}>{it.text}</T>
        </li>
      ))}
    </ul>
  );
}

/** Số liệu: "dark" (trang chủ, nền tối) hoặc "card" (Về Đại Việt). */
export async function StatsGrid({ variant }: { variant: "dark" | "card" }) {
  const items = await getList("stats");
  const k = LISTS.stats.textKey;
  const attrs = await listAttrs("stats", items);
  if (variant === "card") {
    return (
      <div {...attrs} className="grid grid-cols-2 gap-4">
        {items.map((s) => (
          <div key={s.id} className="rounded-2xl bg-mist p-6">
            <p className="font-display text-3xl font-bold text-brand">
              <CountUp value={Number(s.value)} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm font-semibold">
              <T k={k(s.id, "label")}>{s.label}</T>
            </p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div {...attrs} className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/10 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.id} className="bg-ink p-4 sm:p-8">
          <p className="font-display text-3xl font-bold text-orange-400 sm:text-5xl">
            <CountUp value={Number(s.value)} suffix={s.suffix} />
          </p>
          <p className="mt-3 font-semibold">
            <T k={k(s.id, "label")}>{s.label}</T>
          </p>
          <p className="mt-1 text-sm text-slate-400">
            <T k={k(s.id, "note")}>{s.note}</T>
          </p>
        </div>
      ))}
    </div>
  );
}

const worryIcons: Record<string, typeof Home> = { o: Home, "di-lai": Bike, "ho-so": FileText, "thu-nhap": Wallet };

export async function WorriesGrid() {
  const items = await getList("worries");
  const k = LISTS.worries.textKey;
  return (
    <div {...await listAttrs("worries", items)} className="mt-8 grid gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((w, i) => {
        const Icon = worryIcons[w.id] ?? BadgeCheck;
        return (
          <article key={w.id} className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-xl sm:p-6">
            <span className="absolute top-5 right-6 font-display text-4xl font-bold text-slate-100 transition-colors group-hover:text-orange-100 sm:text-5xl">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="relative mt-5 font-display text-xl font-bold">
              <T k={k(w.id, "title")}>{w.title}</T>
            </h3>
            <p className="mt-2 text-sm text-slate-500 line-through decoration-slate-300">
              <T k={k(w.id, "worry")}>{w.worry}</T>
            </p>
            <p className="mt-3 flex gap-2 text-sm leading-relaxed font-medium text-ink">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <T k={k(w.id, "answer")}>{w.answer}</T>
            </p>
          </article>
        );
      })}
    </div>
  );
}

export async function AreasGrid() {
  const items = await getList("areas");
  const k = LISTS.areas.textKey;
  return (
    <div {...await listAttrs("areas", items)} className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-4">
      {items.map((a, i) => (
        <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <span className="font-display text-sm font-bold text-slate-400">{String(i + 1).padStart(2, "0")}</span>
          <p className="mt-2 flex items-center gap-1.5 font-display text-base font-bold sm:mt-3 sm:gap-2 sm:text-xl">
            <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
            <T k={k(a.id, "name")}>{a.name}</T>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            <T k={k(a.id, "province")}>{a.province}</T>
          </p>
        </div>
      ))}
    </div>
  );
}

/** Khu công nghiệp ở chân trang (dùng chung danh sách "areas"). */
export async function AreasFooterList() {
  const items = await getList("areas");
  const k = LISTS.areas.textKey;
  return (
    <ul {...await listAttrs("areas", items)} className="mt-4 space-y-2 text-sm">
      {items.map((a) => (
        <li key={a.id}>
          <T k={k(a.id, "name")}>{a.name}</T>{" "}
          <span className="block text-xs text-slate-600 sm:inline sm:text-sm">
            · <T k={k(a.id, "province")}>{a.province}</T>
          </span>
        </li>
      ))}
    </ul>
  );
}

export async function StepsList({ list, light = false }: { list: "steps-worker" | "steps-business"; light?: boolean }) {
  const items = await getList(list);
  const k = LISTS[list].textKey;
  return (
    <ol {...await listAttrs(list, items)} className="space-y-4">
      {items.map((s, i) => (
        <li key={s.id} className="flex gap-4">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-bold text-white ${light ? "bg-brand" : "bg-ink"}`}>
            {i + 1}
          </span>
          <span>
            <span className={`block font-semibold ${light ? "text-white" : ""}`}>
              <T k={k(s.id, "title")}>{s.title}</T>
            </span>
            <span className={`text-sm leading-relaxed ${light ? "text-slate-400" : "text-slate-600"}`}>
              <T k={k(s.id, "text")}>{s.text}</T>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export async function BusinessValuesGrid() {
  const items = await getList("business-values");
  const k = LISTS["business-values"].textKey;
  return (
    <div {...await listAttrs("business-values", items)} className="mt-8 grid gap-5 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((v) => (
        <article key={v.id} className="rounded-2xl border border-slate-200 p-6">
          <BadgeCheck className="h-7 w-7 text-brand" aria-hidden="true" />
          <h3 className="mt-4 font-display text-lg font-bold">
            <T k={k(v.id, "title")}>{v.title}</T>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            <T k={k(v.id, "text")}>{v.text}</T>
          </p>
        </article>
      ))}
    </div>
  );
}

/** Logo đối tác trong khung trắng; chưa có logo thì hiện tên. */
function PartnerLogo({ name, logo, className }: { name: string; logo: string; className: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 ${className}`}>
      {logo ? (
        <span className="relative h-full w-full">
          <Image src={logoSrc(logo)} alt={name} fill sizes="160px" unoptimized className="object-contain" />
        </span>
      ) : (
        <span className="text-center font-display text-[10px] leading-tight font-bold text-ink [overflow-wrap:anywhere]">{name}</span>
      )}
    </span>
  );
}

/** Dải logo khách hàng chạy ngang. */
export async function PartnersStrip() {
  const items = await getList("partners");
  if (items.length === 0) return null;
  // 4 bản: mỗi nửa đủ phủ màn hình rộng, không lộ khoảng trống.
  const row = [...items, ...items, ...items, ...items];
  return (
    <div {...await listAttrs("partners", items)} className="overflow-hidden" aria-label="Doanh nghiệp đối tác">
      {/* Khoảng cách nằm trong từng ô (pr-4, không dùng gap) để dịch -50% khớp đúng 2 bản → nối đuôi liền mạch. */}
      <div className="marquee flex w-max">
        {row.map((p, i) => (
          <div key={`${p.id}-${i}`} className="shrink-0 pr-4" aria-hidden={i >= items.length}>
            <div className="flex h-32 w-52 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6">
              {p.logo && (
                <span className="relative h-12 w-full">
                  <Image src={logoSrc(p.logo)} alt="" fill sizes="200px" unoptimized className="object-contain" />
                </span>
              )}
              <span className="text-center text-sm font-bold tracking-wide text-ink">{p.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lưới khách hàng (trang Về Đại Việt). */
export async function PartnersGrid() {
  const items = await getList("partners");
  const k = LISTS.partners.textKey;
  return (
    <div {...await listAttrs("partners", items)} className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((p) => (
        <div key={p.id} className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center">
          <PartnerLogo name={p.name} logo={p.logo} className="h-20 w-full border-0" />
          <p className="text-sm text-slate-500">
            <T k={k(p.id, "note")}>{p.note}</T>
          </p>
        </div>
      ))}
    </div>
  );
}

/** Thẻ tin tuyển dụng: ảnh · tên việc · nhà máy · nơi làm · lương. */
export function JobCard({ job }: { job: Job }) {
  return (
    <article className="relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-royal/30 hover:shadow-xl sm:p-5">
      {job.urgent && (
        <span className="absolute -top-2.5 right-3 flex items-center gap-1 rounded-md bg-[#ef4444] px-2.5 py-1 text-xs font-semibold text-white shadow-md">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Tuyển gấp
        </span>
      )}
      <div className="flex gap-4">
        <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white sm:h-20 sm:w-20">
          {job.image && isUploadUrl(job.image) ? (
            <Image src={`/api${job.image}`} alt="" fill sizes="80px" unoptimized className="object-cover" />
          ) : (
            <span className="px-1 text-center font-display text-[10px] leading-tight font-bold text-ink [overflow-wrap:anywhere]">{job.company ?? "Đại Việt"}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] leading-snug font-bold text-ink sm:text-base">
            <Link href={`/viec-lam/${job.slug}`} className="after:absolute after:inset-0 hover:text-royal">
              {job.title}
            </Link>
          </h3>
          {job.company && <p className="mt-1.5 truncate text-sm font-medium text-royal uppercase">{job.company}</p>}
          {job.area && (
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {job.area}
            </p>
          )}
        </div>
      </div>
      {job.salary && (
        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#eef4ff] px-4 py-2.5 text-sm text-slate-600 sm:py-3">
            <Banknote className="h-5 w-5 text-royal" aria-hidden="true" />
            <span className="font-display text-lg font-bold text-royal">{job.salary}</span>
          </p>
        </div>
      )}
    </article>
  );
}

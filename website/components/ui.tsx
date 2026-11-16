import Image from "next/image";
import Link from "next/link";
import { T } from "./editable";

/** Chữ thường → bọc T (sửa được) khi có mã; JSX giữ nguyên. */
function ed(k: string | undefined, v: React.ReactNode): React.ReactNode {
  return k && typeof v === "string" ? <T k={k}>{v}</T> : v;
}

/** Logo Đại Việt — cùng logo với CRM. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="SARAM VINA - ĐẠI VIỆT — Trang chủ">
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
        <Image src="/dai-viet-mark.png" alt="Logo Đại Việt" fill sizes="40px" className="object-contain p-0.5" priority />
      </span>
      <span className="leading-none">
        <span className={`block font-display text-base font-bold tracking-tight sm:text-lg ${light ? "text-white" : "text-ink"}`}>
          SARAM VINA <span className="text-brand">- ĐẠI VIỆT</span>
        </span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.18em] ${light ? "text-slate-400" : "text-slate-500"}`}>
          Cung ứng nhân lực
        </span>
      </span>
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  light = false,
  center = false,
  k,
}: {
  /** Mã sửa nội dung, vd "home.services" → home.services.eyebrow/title/text. */
  k?: string;
  eyebrow: string;
  title: React.ReactNode;
  text?: string;
  light?: boolean;
  center?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-brand">{ed(k && `${k}.eyebrow`, eyebrow)}</p>
      <h2 className={`mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl ${light ? "text-white" : "text-ink"}`}>
        {ed(k && `${k}.title`, title)}
      </h2>
      {text && <p className={`mt-4 text-base leading-relaxed ${light ? "text-slate-300" : "text-slate-600"}`}>{ed(k && `${k}.text`, text)}</p>}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  className?: string;
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "light" | "outline";
}) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark shadow-lg shadow-orange-900/20",
    light: "bg-white text-ink hover:bg-slate-100",
    outline: "border border-slate-300 text-ink hover:border-ink",
  }[variant];
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${styles} ${className}`}
    >
      {children}
    </Link>
  );
}

/** Trang con: dải tiêu đề tối ở đầu trang. */
export function PageHero({ k, eyebrow, title, text }: { k: string; eyebrow: string; title: string; text: string }) {
  return (
    <section className="hero-bg relative overflow-hidden text-white">
      <div className="grid-dots absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 pt-32 pb-16 sm:px-6 sm:pt-36 sm:pb-20">
        <p className="text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-orange-400">{ed(`${k}.eyebrow`, eyebrow)}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">{ed(`${k}.title`, title)}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">{ed(`${k}.text`, text)}</p>
      </div>
    </section>
  );
}

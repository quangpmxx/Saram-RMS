import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Bike, Building2, FileText, Home, MapPin, Wallet, ArrowRight } from "lucide-react";
import { dorms, sampleJobs, worries, partners } from "@/lib/content";
import { SectionHeading } from "./ui";

const worryIcons = { o: Home, "di-lai": Bike, "ho-so": FileText, "thu-nhap": Wallet } as const;

/** 4 nỗi lo của người lao động → cách SARAM giải quyết. */
export function WorriesSection() {
  return (
    <section className="bg-mist py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Thấu hiểu người lao động"
          title={
            <>
              4 nỗi lo khi đi làm xa — <span className="text-brand">SARAM lo hết</span>
            </>
          }
          text="Giải quyết trọn những điều người lao động lo nhất là cách để họ yên tâm làm việc và gắn bó lâu dài với nhà máy."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {worries.map((w, i) => {
            const Icon = worryIcons[w.key as keyof typeof worryIcons];
            return (
              <article
                key={w.key}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-xl"
              >
                <span className="absolute top-5 right-6 font-display text-5xl font-bold text-slate-100 transition-colors group-hover:text-orange-100">
                  0{i + 1}
                </span>
                <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="relative mt-5 font-display text-xl font-bold">{w.title}</h3>
                <p className="mt-2 text-sm text-slate-500 line-through decoration-slate-300">{w.worry}</p>
                <p className="mt-3 flex gap-2 text-sm font-medium leading-relaxed text-ink">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  {w.answer}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Ký túc xá — ảnh thật từ hồ sơ năng lực. */
export function DormsSection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="Chỗ ở"
            title="Ký túc xá ngay sát khu công nghiệp"
            text="Mạng lưới ký túc xá tại Quang Châu, Quế Võ, Nam Sơn – Hạp Lĩnh và VSIP. Mỗi khu 15–30 phòng, phòng 18–25m² cho 6–8 người, khép kín, đầy đủ tiện nghi."
          />
          <div className="flex shrink-0 gap-8">
            {[
              ["4+", "khu vực"],
              ["15–30", "phòng/khu"],
              ["100%", "phòng khép kín"],
            ].map(([n, l]) => (
              <div key={l}>
                <p className="font-display text-3xl font-bold text-brand">{n}</p>
                <p className="text-xs font-medium text-slate-500">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {dorms.map((d) => (
            <article key={d.name} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="grid grid-cols-2 gap-1">
                {d.images.map((src, i) => (
                  <div key={src} className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={src}
                      alt={`${d.name} — ảnh ${i + 1}`}
                      fill
                      sizes="(min-width: 1024px) 280px, 50vw"
                      className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
              <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold">{d.name}</h3>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">{d.capacity}</span>
                </div>
                <ul className="mt-4 space-y-2">
                  {d.points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-slate-600">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Xe điện miễn phí. */
export function BikeSection() {
  return (
    <section className="hero-bg relative overflow-hidden py-20 text-white sm:py-24">
      <div className="grid-dots absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            light
            eyebrow="Đi lại"
            title={
              <>
                Mượn xe điện đi làm — <span className="text-orange-400">0 đồng</span>
              </>
            }
            text="Không cần mua xe, không lo lỡ ca. SARAM cho người lao động mượn xe điện miễn phí và bảo dưỡng định kỳ để ai cũng đi làm đúng giờ."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["2 người / 1 xe", "Ghép cặp theo ca kíp"],
              ["Miễn phí 100%", "Không thu bất kỳ chi phí"],
              ["Bảo dưỡng trọn gói", "SARAM lo sửa chữa"],
            ].map(([t, s]) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-display font-bold">{t}</p>
                <p className="mt-1 text-xs text-slate-400">{s}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[0.8fr_1fr] items-end gap-4">
          <div className="relative aspect-[240/381] overflow-hidden rounded-3xl">
            <Image src="/images/xe-dien-1.png" alt="Người lao động nhận xe điện SARAM" fill sizes="240px" className="object-cover" />
          </div>
          <div className="relative aspect-[360/307] overflow-hidden rounded-3xl">
            <Image src="/images/xe-dien-2.png" alt="Hệ thống xe điện miễn phí SARAM VINA" fill sizes="320px" className="object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Thủ tục + thu nhập. */
export function PolicySection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <article className="rounded-3xl bg-mist p-8 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Hồ sơ</p>
          <h3 className="mt-3 font-display text-3xl font-bold">
            Chỉ cần <span className="text-brand">CCCD</span>
          </h3>
          <p className="mt-3 text-slate-600">Không thủ tục rườm rà — có thể nhận việc ngay trong ngày.</p>
          <ul className="mt-6 space-y-3">
            {[
              ["Vỏ hồ sơ miễn phí", "Có sẵn biểu mẫu, sơ yếu lý lịch chuẩn."],
              ["Chụp ảnh thẻ tại chỗ", "Ảnh 3x4, 4x6 chụp và in miễn phí."],
              ["Photo giấy tờ không giới hạn", "Sao chụp mọi giấy tờ cần nộp nhà máy."],
            ].map(([t, s]) => (
              <li key={t} className="flex gap-3 rounded-2xl bg-white p-4">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="text-sm text-slate-500">{s}</span>
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="flex flex-col rounded-3xl bg-royal p-8 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Thu nhập</p>
          <h3 className="mt-3 font-display text-3xl font-bold">Phụ cấp theo ngày công</h3>
          <p className="mt-6 font-display text-5xl font-bold tracking-tight text-orange-300 sm:text-6xl">30–70K</p>
          <p className="mt-1 text-blue-100">đồng / công, tùy từng đơn hàng</p>
          <div className="mt-8 rounded-2xl bg-white/10 p-5">
            <p className="text-sm text-blue-100">Đi làm đủ 26–28 công, mỗi tháng nhận thêm</p>
            <p className="mt-1 font-display text-3xl font-bold">800.000 – 1.800.000đ</p>
          </div>
          <p className="mt-auto pt-6 text-xs text-blue-200">
            Mức phụ cấp cụ thể được báo rõ trước khi nhận việc, theo từng nhà máy và vị trí.
          </p>
        </article>
      </div>
    </section>
  );
}

export function JobCard({ job }: { job: (typeof sampleJobs)[number] }) {
  return (
    <article className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Tin mẫu</span>
      </div>
      <h3 className="mt-4 font-display text-lg font-bold leading-snug">{job.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{job.company}</p>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600">
        <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
        {job.area}
      </p>
      <p className="mt-1 text-sm text-slate-600">{job.gender}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {job.perks.map((p) => (
          <span key={p} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {p}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 mt-5">
        <span className="font-display font-bold text-brand">{job.salary}</span>
        <Link href="/lien-he" className="flex items-center gap-1 text-sm font-semibold text-ink group-hover:text-brand">
          Ứng tuyển <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function PartnersStrip() {
  const row = [...partners, ...partners];
  return (
    <div className="overflow-hidden" aria-label="Doanh nghiệp đối tác">
      <div className="marquee flex w-max gap-4">
        {row.map((p, i) => (
          <div
            key={`${p.name}-${i}`}
            className="flex min-w-48 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-5"
            aria-hidden={i >= partners.length}
          >
            <span className="font-display text-lg font-bold tracking-wide text-ink">{p.name}</span>
            <span className="text-xs text-slate-500">{p.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepsList({ steps, light = false }: { steps: { title: string; text: string }[]; light?: boolean }) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-bold text-white ${light ? "bg-brand" : "bg-ink"}`}
          >
            {i + 1}
          </span>
          <span>
            <span className={`block font-semibold ${light ? "text-white" : ""}`}>{s.title}</span>
            <span className={`text-sm leading-relaxed ${light ? "text-slate-400" : "text-slate-600"}`}>{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

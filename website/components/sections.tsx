import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  Bike,
  FileText,
  Flame,
  Home,
  MapPin,
  Wallet,
} from "lucide-react";
import {
  dorms,
  sampleJobs,
  worries,
  partners,
  partnerOf,
  type Partner,
} from "@/lib/content";
import { SectionHeading } from "./ui";
import { EImage, T } from "./editable";

const worryIcons = {
  o: Home,
  "di-lai": Bike,
  "ho-so": FileText,
  "thu-nhap": Wallet,
} as const;

/** 4 nỗi lo của người lao động → cách SARAM giải quyết. */
export function WorriesSection() {
  return (
    <section className="bg-mist py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          k="worries"
          eyebrow="Thấu hiểu người lao động"
          title={
            <>
              <T k="worries.title1">4 nỗi lo khi đi làm xa —</T>{" "}
              <span className="text-brand">
                <T k="worries.title2">Đại Việt lo hết</T>
              </span>
            </>
          }
          text="Giải quyết trọn những điều người lao động lo nhất là cách để họ yên tâm làm việc và gắn bó lâu dài với nhà máy."
        />
        <div className="mt-8 grid sm:mt-12 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {worries.map((w, i) => {
            const Icon = worryIcons[w.key as keyof typeof worryIcons];
            return (
              <article
                key={w.key}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-xl sm:p-6"
              >
                <span className="absolute top-5 right-6 font-display text-4xl font-bold text-slate-100 sm:text-5xl transition-colors group-hover:text-orange-100">
                  0{i + 1}
                </span>
                <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="relative mt-5 font-display text-xl font-bold">
                  <T k={`worries.${w.key}.title`}>{w.title}</T>
                </h3>
                <p className="mt-2 text-sm text-slate-500 line-through decoration-slate-300">
                  <T k={`worries.${w.key}.worry`}>{w.worry}</T>
                </p>
                <p className="mt-3 flex gap-2 text-sm font-medium leading-relaxed text-ink">
                  <BadgeCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                    aria-hidden="true"
                  />
                  <T k={`worries.${w.key}.answer`}>{w.answer}</T>
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
    <section className="py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            k="dorms"
            eyebrow="Chỗ ở"
            title="Ký túc xá ngay sát khu công nghiệp"
            text="Mạng lưới ký túc xá tại Quang Châu, Quế Võ, Nam Sơn – Hạp Lĩnh và VSIP. Mỗi khu 15–30 phòng, phòng 18–25m² cho 6–8 người, khép kín, đầy đủ tiện nghi."
          />
          <div className="flex shrink-0 gap-8">
            {[
              ["4+", "khu vực"],
              ["15–30", "phòng/khu"],
              ["100%", "phòng khép kín"],
            ].map(([n, l], i) => (
              <div key={l}>
                <p className="font-display text-3xl font-bold text-brand">
                  <T k={`dorms.fact${i}.value`}>{n}</T>
                </p>
                <p className="text-xs font-medium text-slate-500">
                  <T k={`dorms.fact${i}.label`}>{l}</T>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid sm:mt-12 gap-8 lg:grid-cols-2">
          {dorms.map((d, di) => (
            <article
              key={d.name}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
            >
              <div className="grid grid-cols-2 gap-1">
                {d.images.map((src, i) => (
                  <div
                    key={src}
                    className="relative aspect-[4/3] overflow-hidden sm:aspect-[4/5]"
                  >
                    <EImage
                      k={`dorms.${di}.image${i}`}
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
                  <h3 className="font-display text-xl font-bold">
                    <T k={`dorms.${di}.name`}>{d.name}</T>
                  </h3>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                    <T k={`dorms.${di}.capacity`}>{d.capacity}</T>
                  </span>
                </div>
                <ul className="mt-4 space-y-2">
                  {d.points.map((p, pi) => (
                    <li key={p} className="flex gap-2 text-sm text-slate-600">
                      <BadgeCheck
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                        aria-hidden="true"
                      />
                      <T k={`dorms.${di}.point${pi}`}>{p}</T>
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
    <section className="hero-bg relative overflow-hidden py-14 text-white sm:py-24">
      <div className="grid-dots absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            light
            k="bike"
            eyebrow="Đi lại"
            title={
              <>
                <T k="bike.title1">Mượn xe điện đi làm —</T>{" "}
                <span className="text-orange-400">
                  <T k="bike.title2">0 đồng</T>
                </span>
              </>
            }
            text="Không cần mua xe, không lo lỡ ca. Đại Việt cho người lao động mượn xe điện miễn phí và bảo dưỡng định kỳ để ai cũng đi làm đúng giờ."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["2 người / 1 xe", "Ghép cặp theo ca kíp"],
              ["Miễn phí 100%", "Không thu bất kỳ chi phí"],
              ["Bảo dưỡng trọn gói", "Đại Việt lo sửa chữa"],
            ].map(([t, s], i) => (
              <div
                key={t}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="font-display font-bold">
                  <T k={`bike.fact${i}.title`}>{t}</T>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  <T k={`bike.fact${i}.text`}>{s}</T>
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[0.8fr_1fr] items-end gap-4">
          <div className="relative aspect-[240/381] overflow-hidden rounded-3xl">
            <EImage
              k="bike.image1"
              src="/images/xe-dien-1.png"
              alt="Người lao động nhận xe điện Đại Việt"
              fill
              sizes="240px"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[360/307] overflow-hidden rounded-3xl">
            <EImage
              k="bike.image2"
              src="/images/xe-dien-2.png"
              alt="Hệ thống xe điện miễn phí Đại Việt"
              fill
              sizes="320px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Thủ tục + thu nhập. */
export function PolicySection() {
  return (
    <section className="py-14 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <article className="rounded-3xl bg-mist p-8 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-brand">
            <T k="policy.docs.eyebrow">Hồ sơ</T>
          </p>
          <h3 className="mt-3 font-display text-3xl font-bold">
            <T k="policy.docs.title1">Chỉ cần</T>{" "}
            <span className="text-brand">
              <T k="policy.docs.title2">CCCD</T>
            </span>
          </h3>
          <p className="mt-3 text-slate-600">
            <T k="policy.docs.text">Không thủ tục rườm rà — có thể nhận việc ngay trong ngày.</T>
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Vỏ hồ sơ miễn phí", "Có sẵn biểu mẫu, sơ yếu lý lịch chuẩn."],
              ["Chụp ảnh thẻ tại chỗ", "Ảnh 3x4, 4x6 chụp và in miễn phí."],
              [
                "Photo giấy tờ không giới hạn",
                "Sao chụp mọi giấy tờ cần nộp nhà máy.",
              ],
            ].map(([t, s], i) => (
              <li key={t} className="flex gap-3 rounded-2xl bg-white p-4">
                <BadgeCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <span>
                  <span className="block font-semibold">
                    <T k={`policy.docs.item${i}.title`}>{t}</T>
                  </span>
                  <span className="text-sm text-slate-500">
                    <T k={`policy.docs.item${i}.text`}>{s}</T>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="flex flex-col rounded-3xl bg-royal p-8 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-blue-200">
            <T k="policy.income.eyebrow">Thu nhập</T>
          </p>
          <h3 className="mt-3 font-display text-3xl font-bold">
            <T k="policy.income.title">Phụ cấp theo ngày công</T>
          </h3>
          <p className="mt-6 font-display text-5xl font-bold tracking-tight text-orange-300 sm:text-6xl">
            <T k="policy.income.amount">30–70K</T>
          </p>
          <p className="mt-1 text-blue-100">
            <T k="policy.income.unit">đồng / công, tùy từng đơn hàng</T>
          </p>
          <div className="mt-8 rounded-2xl bg-white/10 p-5">
            <p className="text-sm text-blue-100">
              <T k="policy.income.monthly_label">Đi làm đủ 26–28 công, mỗi tháng nhận thêm</T>
            </p>
            <p className="mt-1 font-display text-3xl font-bold">
              <T k="policy.income.monthly_amount">800.000 – 1.800.000đ</T>
            </p>
          </div>
          <p className="mt-auto pt-6 text-xs text-blue-200">
            <T k="policy.income.note">
              Mức phụ cấp cụ thể được báo rõ trước khi nhận việc, theo từng nhà máy và vị trí.
            </T>
          </p>
        </article>
      </div>
    </section>
  );
}

/** Logo công ty trong khung trắng; chưa có file logo thì hiện tên viết tắt. */
export function PartnerLogo({
  partner,
  className = "h-16 w-16 sm:h-20 sm:w-20",
}: {
  partner: Partner;
  className?: string;
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 ${className}`}
    >
      {partner.logo ? (
        <span className="relative h-full w-full">
          <Image
            src={partner.logo}
            alt={partner.name}
            fill
            sizes="160px"
            unoptimized
            className="object-contain"
          />
        </span>
      ) : (
        <span className="text-center font-display text-[10px] font-bold leading-tight text-ink [overflow-wrap:anywhere]">
          {partner.name}
        </span>
      )}
    </span>
  );
}

/** Thẻ tin tuyển dụng: logo · tên việc · công ty · nơi làm · dải lương. */
export function JobCard({ job }: { job: (typeof sampleJobs)[number] }) {
  const partner = partnerOf(job.partner);
  return (
    <article className="relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 transition-all hover:-translate-y-1 hover:border-royal/30 hover:shadow-xl">
      {job.urgent && (
        <span className="absolute -top-2.5 right-3 flex items-center gap-1 rounded-md bg-[#ef4444] px-2.5 py-1 text-xs font-semibold text-white shadow-md">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Tuyển gấp
        </span>
      )}
      <div className="flex gap-4">
        <PartnerLogo partner={partner} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-bold leading-snug text-ink sm:text-base">
            <Link
              href="/lien-he"
              className="after:absolute after:inset-0 hover:text-royal"
            >
              {job.title}
            </Link>
          </h3>
          <p className="mt-1.5 truncate text-sm font-medium uppercase text-royal">
            {partner.name}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {job.area}
          </p>
        </div>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="flex items-center justify-center gap-2 rounded-xl bg-[#eef4ff] px-4 py-2.5 text-sm text-slate-600 sm:py-3">
          <Banknote className="h-5 w-5 text-royal" aria-hidden="true" />
          <span className="font-display text-lg font-bold text-royal">
            {job.salary} Triệu
          </span>
          / tháng
        </p>
      </div>
    </article>
  );
}

/** Dải logo khách hàng chạy ngang. */
export function PartnersStrip() {
  // 4 bản: mỗi nửa (2 bản ≈ 2.200px) đủ phủ màn hình rộng, không lộ khoảng trống.
  const row = [...partners, ...partners, ...partners, ...partners];
  return (
    <div className="overflow-hidden" aria-label="Doanh nghiệp đối tác">
      {/* Khoảng cách nằm trong từng ô (pr-4, không dùng gap) để dịch -50% khớp đúng 2 bản → nối đuôi liền mạch. */}
      <div className="marquee flex w-max">
        {row.map((p, i) => (
          <div
            key={`${p.key}-${i}`}
            className="shrink-0 pr-4"
            aria-hidden={i >= partners.length}
          >
            <div className="flex h-32 w-52 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6">
              {p.logo && (
                <span className="relative h-12 w-full">
                  <Image
                    src={p.logo}
                    alt=""
                    fill
                    sizes="200px"
                    unoptimized
                    className="object-contain"
                  />
                </span>
              )}
              <span className="text-center text-sm font-bold tracking-wide text-ink">
                {p.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepsList({
  steps,
  light = false,
  k,
}: {
  steps: { title: string; text: string }[];
  light?: boolean;
  /** Mã sửa nội dung, vd "steps.worker" → steps.worker.0.title… */
  k: string;
}) {
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
            <span
              className={`block font-semibold ${light ? "text-white" : ""}`}
            >
              <T k={`${k}.${i}.title`}>{s.title}</T>
            </span>
            <span
              className={`text-sm leading-relaxed ${light ? "text-slate-400" : "text-slate-600"}`}
            >
              <T k={`${k}.${i}.text`}>{s.text}</T>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

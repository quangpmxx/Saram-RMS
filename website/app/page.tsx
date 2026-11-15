import { ArrowRight, BadgeCheck, Factory, HardHat, MapPin } from "lucide-react";
import { areas, businessSteps, company, sampleJobs, stats, workerSteps } from "@/lib/content";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { RegisterForm } from "@/components/register-form";
import {
  BikeSection,
  DormsSection,
  JobCard,
  PartnersStrip,
  PolicySection,
  StepsList,
  WorriesSection,
} from "@/components/sections";

export default function HomePage() {
  return (
    <>
      {/* ĐẦU TRANG */}
      <section className="hero-bg relative overflow-hidden text-white">
        <div className="grid-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-28 pb-20 sm:px-6 sm:pt-36 lg:grid-cols-[1.25fr_1fr] lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-200">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              Cung ứng nhân lực KCN {company.area} từ {company.since}
            </p>
            <h1 className="mt-6 font-display text-4xl leading-[1.1] font-bold tracking-tight sm:text-6xl">
              Việc làm nhà máy
              <br />
              <span className="text-orange-400">có chỗ ở, có xe đi làm.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              SARAM VINA kết nối người lao động với các nhà máy lớn tại Bắc Ninh, Bắc Giang. Ký túc xá sát KCN, mượn xe
              điện miễn phí, chỉ cần CCCD là nhận việc.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/viec-lam">
                <HardHat className="h-4 w-4" aria-hidden="true" /> Tôi cần tìm việc
              </ButtonLink>
              <ButtonLink href="/doanh-nghiep" variant="light">
                <Factory className="h-4 w-4" aria-hidden="true" /> Nhà máy cần tuyển người
              </ButtonLink>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              {["Miễn phí 100% cho người lao động", "Không giữ giấy tờ gốc", "Báo rõ lương trước khi nhận việc"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-orange-400" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <RegisterForm />
        </div>
      </section>

      {/* ĐỐI TÁC */}
      <section className="border-b border-slate-200 bg-mist py-10">
        <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Đồng hành cùng các tập đoàn công nghệ toàn cầu
        </p>
        <PartnersStrip />
      </section>

      {/* HAI HƯỚNG PHỤC VỤ */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            center
            eyebrow="Dịch vụ"
            title="Một đầu mối cho cả người lao động và nhà máy"
            text="SARAM đứng giữa: lo trọn chỗ ở, đi lại, hồ sơ cho người lao động, để nhà máy nhận đủ người, đúng hạn, làm việc ổn định."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="flex flex-col rounded-3xl border border-slate-200 p-8 sm:p-10">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
                <HardHat className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="mt-6 font-display text-2xl font-bold">Dành cho người lao động</h3>
              <p className="mt-2 text-slate-600">Tìm việc ở nhà máy gần chỗ ở, thu nhập rõ ràng, không mất phí.</p>
              <div className="mt-6">
                <StepsList steps={workerSteps} />
              </div>
              <div className="mt-8">
                <ButtonLink href="/nguoi-lao-dong">
                  Quyền lợi người lao động <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            </article>
            <article className="flex flex-col rounded-3xl bg-ink p-8 text-white sm:p-10">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-orange-400">
                <Factory className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="mt-6 font-display text-2xl font-bold">Dành cho nhà máy</h3>
              <p className="mt-2 text-slate-300">Bổ sung quân số nhanh, lao động chuyên cần, ít nghỉ việc.</p>
              <div className="mt-6">
                <StepsList light steps={businessSteps} />
              </div>
              <div className="mt-8">
                <ButtonLink href="/doanh-nghiep" variant="light">
                  Giải pháp cho doanh nghiệp <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* SỐ LIỆU */}
      <section className="bg-ink py-16 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-ink p-6 sm:p-8">
                <p className="font-display text-4xl font-bold text-orange-400 sm:text-5xl">
                  <CountUp value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-3 font-semibold">{s.label}</p>
                <p className="mt-1 text-sm text-slate-400">{s.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WorriesSection />
      <DormsSection />
      <BikeSection />
      <PolicySection />

      {/* ĐỊA BÀN */}
      <section className="bg-mist py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Địa bàn"
            title="Có mặt tại các KCN trọng điểm"
            text="Ký túc xá và đội ngũ điều phối đặt ngay tại khu công nghiệp — người lao động ở gần, nhà máy nhận người nhanh."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((a, i) => (
              <div key={a.name} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="font-display text-sm font-bold text-slate-400">0{i + 1}</span>
                <p className="mt-3 flex items-center gap-2 font-display text-xl font-bold">
                  <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
                  KCN {a.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">{a.province}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VIỆC LÀM */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow="Việc làm" title="Đang tuyển gấp" />
            <ButtonLink href="/viec-lam" variant="outline">
              Xem tất cả việc làm <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {sampleJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
        </div>
      </section>

      {/* KÊU GỌI */}
      <section className="hero-bg relative overflow-hidden py-20 text-white">
        <div className="grid-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Sẵn sàng ký kết hợp tác cùng quý doanh nghiệp
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
            Cam kết bàn giao đủ quân số, đúng tiến độ và giữ an ninh trật tự tốt nhất tại nơi ở của người lao động.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/lien-he">Trao đổi nhu cầu tuyển dụng</ButtonLink>
            <ButtonLink href="/ve-chung-toi" variant="light">
              Tìm hiểu về SARAM
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

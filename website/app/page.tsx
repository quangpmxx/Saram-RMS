import { ArrowRight, BadgeCheck, Factory, HardHat, MapPin } from "lucide-react";
import { areas, businessSteps, company, sampleJobs, stats, workerSteps } from "@/lib/content";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { T } from "@/components/editable";
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
              <T k="home.hero.badge">{`Cung ứng nhân lực KCN ${company.area} từ ${company.since}`}</T>
            </p>
            <h1 className="mt-6 font-display text-[1.7rem] leading-tight font-bold tracking-tight text-pretty sm:text-4xl lg:text-[2.1rem] xl:text-4xl">
              <span className="sm:whitespace-nowrap">
                <T k="home.hero.title">Việc Làm Saram Vina - Đại Việt</T>
              </span>
              <span className="mt-2 block text-xl leading-snug text-orange-400 sm:whitespace-nowrap sm:text-2xl">
                <T k="home.hero.subtitle">Cung ứng lao động uy tín 10 năm tại Bắc Ninh</T>
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              <T k="home.hero.text">
                Tại Đại Việt, người lao động sẽ được kết nối và làm việc tại các doanh nghiệp lớn. Hỗ trợ hồ sơ, ký túc xá, xe điện đi lại. Thủ tục đơn giản – nhận việc ngay trong ngày – cam kết không thu phí.
              </T>
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <ButtonLink href="/viec-lam">
                <HardHat className="h-4 w-4" aria-hidden="true" /> <T k="home.hero.btn_worker">Tôi cần tìm việc</T>
              </ButtonLink>
              <ButtonLink href="/doanh-nghiep" variant="light">
                <Factory className="h-4 w-4" aria-hidden="true" /> <T k="home.hero.btn_business">Nhà máy cần tuyển người</T>
              </ButtonLink>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              {["Miễn phí 100% cho người lao động", "Không giữ giấy tờ gốc", "Báo rõ lương trước khi nhận việc"].map((t, i) => (
                <li key={t} className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-orange-400" aria-hidden="true" />
                  <T k={`home.hero.point${i + 1}`}>{t}</T>
                </li>
              ))}
            </ul>
          </div>
          <RegisterForm />
        </div>
      </section>

      {/* ĐỐI TÁC */}
      <section className="border-b border-slate-200 bg-mist py-10">
        <p className="mb-6 px-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-balance text-slate-500 sm:tracking-[0.2em]">
          <T k="home.partners.title">Đồng hành cùng các tập đoàn công nghệ toàn cầu</T>
        </p>
        <PartnersStrip />
      </section>

      {/* HAI HƯỚNG PHỤC VỤ */}
      <section className="py-14 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            center
            k="home.services"
            eyebrow="Dịch vụ"
            title="Một đầu mối cho cả người lao động và nhà máy"
            text="Đại Việt đứng giữa: lo trọn chỗ ở, đi lại, hồ sơ cho người lao động, để nhà máy nhận đủ người, đúng hạn, làm việc ổn định."
          />
          <div className="mt-8 grid sm:mt-12 gap-6 lg:grid-cols-2">
            <article className="flex flex-col rounded-3xl border border-slate-200 p-8 sm:p-10">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
                <HardHat className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="mt-6 font-display text-2xl font-bold">
                <T k="home.services.worker.title">Dành cho người lao động</T>
              </h3>
              <p className="mt-2 text-slate-600">
                <T k="home.services.worker.text">Tìm việc ở nhà máy gần chỗ ở, thu nhập rõ ràng, không mất phí.</T>
              </p>
              <div className="mt-6">
                <StepsList k="steps.worker" steps={workerSteps} />
              </div>
              <div className="mt-8">
                <ButtonLink href="/nguoi-lao-dong">
                  <T k="home.services.worker.btn">Quyền lợi người lao động</T> <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            </article>
            <article className="flex flex-col rounded-3xl bg-ink p-8 text-white sm:p-10">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-orange-400">
                <Factory className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="mt-6 font-display text-2xl font-bold">
                <T k="home.services.business.title">Dành cho nhà máy</T>
              </h3>
              <p className="mt-2 text-slate-300">
                <T k="home.services.business.text">Bổ sung quân số nhanh, lao động chuyên cần, ít nghỉ việc.</T>
              </p>
              <div className="mt-6">
                <StepsList light k="steps.business" steps={businessSteps} />
              </div>
              <div className="mt-8">
                <ButtonLink href="/doanh-nghiep" variant="light">
                  <T k="home.services.business.btn">Giải pháp cho doanh nghiệp</T> <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* SỐ LIỆU */}
      <section className="bg-ink py-16 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/10 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className="bg-ink p-4 sm:p-8">
                <p className="font-display text-3xl font-bold text-orange-400 sm:text-5xl">
                  <CountUp value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-3 font-semibold">
                  <T k={`stats.${i}.label`}>{s.label}</T>
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  <T k={`stats.${i}.note`}>{s.note}</T>
                </p>
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
      <section className="bg-mist py-14 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            k="home.areas"
            eyebrow="Địa bàn"
            title="Có mặt tại các KCN trọng điểm"
            text="Ký túc xá và đội ngũ điều phối đặt ngay tại khu công nghiệp — người lao động ở gần, nhà máy nhận người nhanh."
          />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-4">
            {areas.map((a, i) => (
              <div key={a.name} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
                <span className="font-display text-sm font-bold text-slate-400">0{i + 1}</span>
                <p className="mt-2 flex items-center gap-1.5 font-display text-base font-bold sm:mt-3 sm:gap-2 sm:text-xl">
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
      <section className="py-14 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading k="home.jobs" eyebrow="Việc làm" title="Đang tuyển gấp" />
            <ButtonLink href="/viec-lam" variant="outline">
              <T k="home.jobs.btn">Xem tất cả việc làm</T> <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
          <div className="mt-8 grid sm:mt-10 gap-x-5 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
            {sampleJobs.map((job, i) => (
              <div key={job.slug} className={i >= 3 ? "hidden md:block" : ""}>
                <JobCard job={job} />
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">Tin mẫu để xem giao diện — tin thật sẽ đăng từ trang quản trị.</p>
        </div>
      </section>

      {/* KÊU GỌI */}
      <section className="hero-bg relative overflow-hidden py-14 text-white sm:py-20">
        <div className="grid-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            <T k="home.cta.title">Sẵn sàng ký kết hợp tác cùng quý doanh nghiệp</T>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
            <T k="home.cta.text">
              Cam kết bàn giao đủ quân số, đúng tiến độ và giữ an ninh trật tự tốt nhất tại nơi ở của người lao động.
            </T>
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
            <ButtonLink href="/lien-he">
              <T k="home.cta.btn_contact">Trao đổi nhu cầu tuyển dụng</T>
            </ButtonLink>
            <ButtonLink href="/ve-chung-toi" variant="light">
              <T k="home.cta.btn_about">Tìm hiểu về Đại Việt</T>
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

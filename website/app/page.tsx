import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { ArrowRight, Factory, HardHat } from "lucide-react";
import { company } from "@/lib/content";
import { getJobs } from "@/lib/content-api";
import { AreasGrid, HeroPoints, StatsGrid } from "@/components/lists";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { T } from "@/components/editable";
import { Blocks } from "@/components/blocks";
import { RegisterForm } from "@/components/register";
import {
  BikeSection,
  DormsSection,
  JobCard,
  PartnersStrip,
  PolicySection,
  StepsList,
  WorriesSection,
} from "@/components/sections";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home");
}

export default async function HomePage() {
  const jobs = await getJobs();
  return (
    <Blocks
      page="home"
      items={[
        {
          id: "hero",
          label: "Đầu trang",
          node: (
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
                  <HeroPoints />
                </div>
                <RegisterForm />
              </div>
            </section>
          ),
        },
        {
          id: "partners",
          label: "Đối tác",
          node: (
            <section className="border-b border-slate-200 bg-mist py-10">
              <p className="mb-6 px-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-balance text-slate-500 sm:tracking-[0.2em]">
                <T k="home.partners.title">Đồng hành cùng các tập đoàn công nghệ toàn cầu</T>
              </p>
              <PartnersStrip />
            </section>
          ),
        },
        {
          id: "services",
          label: "Hai hướng phục vụ",
          node: (
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
                      <StepsList list="steps-worker" />
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
                      <StepsList light list="steps-business" />
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
          ),
        },
        {
          id: "stats",
          label: "Số liệu",
          node: (
            <section className="bg-ink py-16 text-white">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <StatsGrid variant="dark" />
              </div>
            </section>
          ),
        },
        {
          id: "worries",
          label: "Nỗi lo người lao động",
          node: (
            <WorriesSection />
          ),
        },
        {
          id: "dorms",
          label: "Ký túc xá",
          node: (
            <DormsSection />
          ),
        },
        {
          id: "bike",
          label: "Xe điện",
          node: (
            <BikeSection />
          ),
        },
        {
          id: "policy",
          label: "Chính sách",
          node: (
            <PolicySection />
          ),
        },
        {
          id: "areas",
          label: "Địa bàn",
          node: (
            <section className="bg-mist py-14 sm:py-24">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <SectionHeading
                  k="home.areas"
                  eyebrow="Địa bàn"
                  title="Có mặt tại các KCN trọng điểm"
                  text="Ký túc xá và đội ngũ điều phối đặt ngay tại khu công nghiệp — người lao động ở gần, nhà máy nhận người nhanh."
                />
                <AreasGrid />
              </div>
            </section>
          ),
        },
        {
          id: "jobs",
          label: "Việc làm",
          node: (
            <section className="py-14 sm:py-24">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                  <SectionHeading k="home.jobs" eyebrow="Việc làm" title="Đang tuyển gấp" />
                  <ButtonLink href="/viec-lam" variant="outline">
                    <T k="home.jobs.btn">Xem tất cả việc làm</T> <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </ButtonLink>
                </div>
                {jobs.length > 0 ? (
                  <div className="mt-8 grid gap-x-5 gap-y-7 sm:mt-10 md:grid-cols-2 lg:grid-cols-3">
                    {jobs.slice(0, 6).map((job, i) => (
                      <div key={job.id} className={i >= 3 ? "hidden md:block" : ""}>
                        <JobCard job={job} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-8 rounded-2xl bg-mist px-5 py-6 text-center text-sm text-slate-500">
                    <T k="home.jobs.empty">Tin tuyển dụng đang được cập nhật — gọi hotline để được tư vấn việc phù hợp ngay.</T>
                  </p>
                )}
              </div>
            </section>
          ),
        },
        {
          id: "cta",
          label: "Kêu gọi hợp tác",
          node: (
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
          ),
        },
      ]}
    />
  );
}

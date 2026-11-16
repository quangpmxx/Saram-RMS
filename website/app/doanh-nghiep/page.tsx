import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { businessSteps, businessValues } from "@/lib/content";
import { PageHero, SectionHeading } from "@/components/ui";
import { DormsSection, PartnersStrip, StepsList } from "@/components/sections";
import { RegisterForm } from "@/components/register-form";
import { T } from "@/components/editable";

export const metadata: Metadata = {
  title: "Giải pháp cung ứng nhân lực cho nhà máy",
  description:
    "Đại Việt cung ứng lao động cho nhà máy tại KCN Bắc Ninh, Bắc Giang: đủ quân số, đúng tiến độ, có ký túc xá và xe đi lại cho lao động.",
};

export default function BusinessPage() {
  return (
    <>
      <PageHero
        k="business.hero"
        eyebrow="Doanh nghiệp"
        title="Giải pháp nhân sự toàn diện cho nhà máy"
        text="Không chỉ tuyển người — Đại Việt lo cả chỗ ở, đi lại và thu nhập cho người lao động, để nhà máy có đội ngũ đi làm đều và gắn bó lâu dài."
      />

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading k="business.values" eyebrow="Giá trị" title="Nhà máy nhận được gì khi làm việc với Đại Việt" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {businessValues.map((v, i) => (
              <article key={v.title} className="rounded-2xl border border-slate-200 p-6">
                <BadgeCheck className="h-7 w-7 text-brand" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg font-bold">
                  <T k={`business.values.${i}.title`}>{v.title}</T>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  <T k={`business.values.${i}.text`}>{v.text}</T>
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-mist py-10">
        <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          <T k="business.partners.title">Đối tác đang hợp tác liên tục</T>
        </p>
        <PartnersStrip />
      </section>

      <DormsSection />

      <section className="hero-bg relative overflow-hidden py-20 text-white sm:py-24">
        <div className="grid-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeading light k="business.process" eyebrow="Quy trình" title="Phối hợp đơn giản, rõ ràng" />
            <div className="mt-8">
              <StepsList light k="steps.business" steps={businessSteps} />
            </div>
          </div>
          <RegisterForm kind="business" />
        </div>
      </section>
    </>
  );
}

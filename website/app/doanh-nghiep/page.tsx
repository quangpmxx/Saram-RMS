import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { BusinessValuesGrid } from "@/components/lists";
import { PageHero, SectionHeading } from "@/components/ui";
import { DormsSection, PartnersStrip, StepsList } from "@/components/sections";
import { RegisterForm } from "@/components/register";
import { T } from "@/components/editable";
import { Blocks } from "@/components/blocks";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("business");
}

export default function BusinessPage() {
  return (
    <Blocks
      page="business"
      items={[
        {
          id: "hero",
          label: "Đầu trang",
          node: (
            <PageHero
              k="business.hero"
              eyebrow="Doanh nghiệp"
              title="Giải pháp nhân sự toàn diện cho nhà máy"
              text="Không chỉ tuyển người — Đại Việt lo cả chỗ ở, đi lại và thu nhập cho người lao động, để nhà máy có đội ngũ đi làm đều và gắn bó lâu dài."
            />
          ),
        },
        {
          id: "values",
          label: "Giá trị",
          node: (
            <section className="py-14 sm:py-24">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <SectionHeading k="business.values" eyebrow="Giá trị" title="Nhà máy nhận được gì khi làm việc với Đại Việt" />
                <BusinessValuesGrid />
              </div>
            </section>
          ),
        },
        {
          id: "partners",
          label: "Đối tác",
          node: (
            <section className="border-y border-slate-200 bg-mist py-10">
              <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-slate-500">
                <T k="business.partners.title">Đối tác đang hợp tác liên tục</T>
              </p>
              <PartnersStrip />
            </section>
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
          id: "process",
          label: "Quy trình + form",
          node: (
            <section className="hero-bg relative overflow-hidden py-14 text-white sm:py-24">
              <div className="grid-dots absolute inset-0" aria-hidden="true" />
              <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
                <div>
                  <SectionHeading light k="business.process" eyebrow="Quy trình" title="Phối hợp đơn giản, rõ ràng" />
                  <div className="mt-8">
                    <StepsList light list="steps-business" />
                  </div>
                </div>
                <RegisterForm kind="business" />
              </div>
            </section>
          ),
        },
      ]}
    />
  );
}

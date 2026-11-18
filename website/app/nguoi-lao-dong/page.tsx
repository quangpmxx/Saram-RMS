import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Blocks } from "@/components/blocks";
import { PageHero, SectionHeading } from "@/components/ui";
import { BikeSection, DormsSection, PolicySection, StepsList, WorriesSection } from "@/components/sections";
import { RegisterForm } from "@/components/register";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("worker");
}

export default function WorkerPage() {
  return (
    <Blocks
      page="worker"
      items={[
        {
          id: "hero",
          label: "Đầu trang",
          node: (
            <PageHero
              k="worker.hero"
              eyebrow="Người lao động"
              title="Đi làm xa mà như ở nhà"
              text="Có chỗ ở sát nhà máy, có xe đi làm, hồ sơ chỉ cần CCCD và thêm phụ cấp mỗi ngày công. Tất cả miễn phí với người lao động."
            />
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
          id: "start",
          label: "3 bước + form",
          node: (
            <section className="bg-mist py-14 sm:py-24">
              <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
                <div>
                  <SectionHeading k="worker.start" eyebrow="Bắt đầu" title="3 bước để có việc làm" />
                  <div className="mt-8">
                    <StepsList list="steps-worker" />
                  </div>
                </div>
                <RegisterForm />
              </div>
            </section>
          ),
        },
      ]}
    />
  );
}

import type { Metadata } from "next";
import { workerSteps } from "@/lib/content";
import { PageHero, SectionHeading } from "@/components/ui";
import { BikeSection, DormsSection, PolicySection, StepsList, WorriesSection } from "@/components/sections";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Quyền lợi người lao động",
  description: "Đi làm qua Đại Việt: ký túc xá sát KCN, mượn xe điện miễn phí, chỉ cần CCCD, phụ cấp 30.000–70.000đ mỗi công.",
};

export default function WorkerPage() {
  return (
    <>
      <PageHero
        k="worker.hero"
        eyebrow="Người lao động"
        title="Đi làm xa mà như ở nhà"
        text="Có chỗ ở sát nhà máy, có xe đi làm, hồ sơ chỉ cần CCCD và thêm phụ cấp mỗi ngày công. Tất cả miễn phí với người lao động."
      />
      <WorriesSection />
      <DormsSection />
      <BikeSection />
      <PolicySection />
      <section className="bg-mist py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeading k="worker.start" eyebrow="Bắt đầu" title="3 bước để có việc làm" />
            <div className="mt-8">
              <StepsList k="steps.worker" steps={workerSteps} />
            </div>
          </div>
          <RegisterForm />
        </div>
      </section>
    </>
  );
}

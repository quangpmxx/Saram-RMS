import type { Metadata } from "next";
import { sampleJobs } from "@/lib/content";
import { PageHero } from "@/components/ui";
import { JobCard } from "@/components/sections";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Việc làm KCN Bắc Ninh, Bắc Giang",
  description: "Việc làm nhà máy đang tuyển tại KCN Quế Võ, VSIP, Nam Sơn – Hạp Lĩnh, Quang Châu. Có ký túc xá, mượn xe điện miễn phí.",
};

export default function JobsPage() {
  return (
    <>
      <PageHero
        eyebrow="Việc làm"
        title="Việc làm nhà máy đang tuyển"
        text="Thông tin lương, ca làm và chế độ được SARAM báo rõ trước khi bạn nhận việc. Ứng tuyển hoàn toàn miễn phí."
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Đây là tin mẫu để xem giao diện. Tin thật sẽ được đăng từ trang quản trị trong CRM.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              {sampleJobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl bg-ink p-2">
              <RegisterForm />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

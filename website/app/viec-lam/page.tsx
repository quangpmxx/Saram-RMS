import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Blocks } from "@/components/blocks";
import { getJobs } from "@/lib/content-api";
import { T } from "@/components/editable";
import { PageHero } from "@/components/ui";
import { JobCard } from "@/components/lists";
import { RegisterForm } from "@/components/register";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("jobs");
}

export default async function JobsPage() {
  const jobs = await getJobs();
  return (
    <Blocks
      page="jobs"
      items={[
        {
          id: "hero",
          label: "Đầu trang",
          node: (
            <PageHero
              k="jobs.hero"
              eyebrow="Việc làm"
              title="Việc làm nhà máy đang tuyển"
              text="Thông tin lương, ca làm và chế độ được Đại Việt báo rõ trước khi bạn nhận việc. Ứng tuyển hoàn toàn miễn phí."
            />
          ),
        },
        {
          id: "list",
          label: "Danh sách việc làm + form",
          node: (
            <section className="py-10 sm:py-20">
              <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_340px]">
                <div>
                  {jobs.length > 0 ? (
                    <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2">
                      {jobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-mist px-5 py-8 text-center text-sm text-slate-500">
                      <T k="jobs.empty">Tin tuyển dụng đang được cập nhật. Bạn để lại thông tin, Đại Việt gọi lại báo việc phù hợp ngay.</T>
                    </p>
                  )}
                </div>
                <aside className="lg:sticky lg:top-28 lg:self-start">
                  <div className="rounded-3xl bg-ink p-2">
                    <RegisterForm />
                  </div>
                </aside>
              </div>
            </section>
          ),
        },
      ]}
    />
  );
}

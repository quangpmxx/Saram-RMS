import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { company } from "@/lib/content";
import { PartnersGrid, StatsGrid } from "@/components/lists";
import { PageHero, SectionHeading } from "@/components/ui";
import { DormsSection } from "@/components/sections";
import { T } from "@/components/editable";
import { Blocks } from "@/components/blocks";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("about");
}

export default function AboutPage() {
  return (
    <Blocks
      page="about"
      items={[
        {
          id: "hero",
          label: "Đầu trang",
          node: (
            <PageHero
              k="about.hero"
              eyebrow="Về chúng tôi"
              title="Đại Việt — uy tín cùng các tập đoàn lớn"
              text={`Từ năm ${company.since}, Đại Việt cung ứng nhân lực cho các nhà máy tại khu công nghiệp trọng điểm ${company.area}, đồng hành liên tục với các tập đoàn công nghệ toàn cầu.`}
            />
          ),
        },
        {
          id: "story",
          label: "Câu chuyện + số liệu",
          node: (
            <section className="py-14 sm:py-24">
              <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
                <div>
                  <SectionHeading k="about.story" eyebrow="Câu chuyện" title="Giải pháp nhân sự toàn diện" />
                  <div className="mt-6 space-y-4 leading-relaxed text-slate-600">
                    <p>
                      <T k="about.story.p1">
                        Chúng tôi hiểu rằng để người lao động gắn bó với nhà máy, chỉ tuyển đủ người là chưa đủ. Họ cần một chỗ ở an toàn, một phương tiện đi làm đúng giờ và một mức thu nhập xứng đáng.
                      </T>
                    </p>
                    <p>
                      <T k="about.story.p2">
                        Vì vậy Đại Việt xây dựng mạng lưới ký túc xá sát khu công nghiệp, hệ thống xe điện cho mượn miễn phí, hỗ trợ trọn gói hồ sơ và phụ cấp theo ngày công — giúp nhà máy có đội ngũ chuyên cần, ổn định.
                      </T>
                    </p>
                  </div>
                </div>
                <StatsGrid variant="card" />
              </div>
            </section>
          ),
        },
        {
          id: "clients",
          label: "Khách hàng",
          node: (
            <section className="bg-ink py-14 text-white sm:py-24">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <SectionHeading light k="about.clients" eyebrow="Khách hàng" title="Hệ thống khách hàng chiến lược" />
                <PartnersGrid />
              </div>
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
      ]}
    />
  );
}

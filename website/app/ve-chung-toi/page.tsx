import type { Metadata } from "next";
import { company, partners, stats } from "@/lib/content";
import { PageHero, SectionHeading } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { DormsSection, PartnerLogo } from "@/components/sections";
import { T } from "@/components/editable";

export const metadata: Metadata = {
  title: "Về Đại Việt",
  description: `${company.legalName} — gần 10 năm cung ứng nhân lực cho các KCN trọng điểm tại Bắc Ninh, Bắc Giang.`,
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        k="about.hero"
        eyebrow="Về chúng tôi"
        title="Đại Việt — uy tín cùng các tập đoàn lớn"
        text={`Từ năm ${company.since}, Đại Việt cung ứng nhân lực cho các nhà máy tại khu công nghiệp trọng điểm ${company.area}, đồng hành liên tục với các tập đoàn công nghệ toàn cầu.`}
      />

      <section className="py-20 sm:py-24">
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
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s, i) => (
              <div key={s.label} className="rounded-2xl bg-mist p-6">
                <p className="font-display text-3xl font-bold text-brand">
                  <CountUp value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm font-semibold">
                  <T k={`stats.${i}.label`}>{s.label}</T>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink py-20 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading light k="about.clients" eyebrow="Khách hàng" title="Hệ thống khách hàng chiến lược" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {partners.map((p) => (
              <div key={p.key} className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center">
                <PartnerLogo partner={p} className="h-20 w-full border-0" />
                <p className="text-sm text-slate-500">
                  <T k={`partners.${p.key}.note`}>{p.note}</T>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DormsSection />
    </>
  );
}

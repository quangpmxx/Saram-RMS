import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { company } from "@/lib/content";
import { PageHero } from "@/components/ui";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Liên hệ",
  description: "Liên hệ SARAM VINA để tìm việc làm hoặc trao đổi nhu cầu tuyển dụng cho nhà máy.",
};

const PENDING = "Đang cập nhật";

export default function ContactPage() {
  const items = [
    { icon: Phone, label: "Hotline", value: company.hotlineDisplay || PENDING },
    { icon: MessageCircle, label: "Zalo", value: company.hotlineDisplay || PENDING },
    { icon: Mail, label: "Email", value: company.email || PENDING },
    { icon: MapPin, label: "Địa chỉ", value: company.address || PENDING },
  ];
  return (
    <>
      <PageHero
        eyebrow="Liên hệ"
        title="Nói chuyện với SARAM"
        text="Người lao động cần tìm việc hay nhà máy cần tuyển người — để lại thông tin, SARAM gọi lại ngay."
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {items.map(({ icon: Icon, label, value }) => (
                <li key={label} className="rounded-2xl border border-slate-200 p-6">
                  <Icon className="h-6 w-6 text-brand" aria-hidden="true" />
                  <p className="mt-4 text-sm text-slate-500">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-500">
              {company.legalName} · Hoạt động tại {company.area}
            </p>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl bg-ink p-2">
              <RegisterForm />
            </div>
            <div className="rounded-3xl bg-mist p-2">
              <RegisterForm kind="business" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

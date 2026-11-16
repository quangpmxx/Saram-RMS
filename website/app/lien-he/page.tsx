import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { company } from "@/lib/content";
import { PageHero } from "@/components/ui";
import { RegisterForm } from "@/components/register-form";
import { T } from "@/components/editable";

export const metadata: Metadata = {
  title: "Liên hệ",
  description: "Liên hệ Đại Việt để tìm việc làm hoặc trao đổi nhu cầu tuyển dụng cho nhà máy.",
};

const PENDING = "Đang cập nhật";

export default function ContactPage() {
  const items = [
    { key: "hotline", icon: Phone, label: "Hotline", value: company.hotlineDisplay || PENDING },
    { key: "zalo", icon: MessageCircle, label: "Zalo", value: company.hotlineDisplay || PENDING },
    { key: "email", icon: Mail, label: "Email", value: company.email || PENDING },
    { key: "address", icon: MapPin, label: "Địa chỉ", value: company.address || PENDING },
  ];
  return (
    <>
      <PageHero
        k="contact.hero"
        eyebrow="Liên hệ"
        title="Nói chuyện với Đại Việt"
        text="Người lao động cần tìm việc hay nhà máy cần tuyển người — để lại thông tin, Đại Việt gọi lại ngay."
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {items.map(({ key, icon: Icon, label, value }) => (
                <li key={label} className="rounded-2xl border border-slate-200 p-6">
                  <Icon className="h-6 w-6 text-brand" aria-hidden="true" />
                  <p className="mt-4 text-sm text-slate-500">
                    <T k={`contact.${key}.label`}>{label}</T>
                  </p>
                  <p className="mt-1 font-semibold">
                    <T k={`contact.${key}.value`}>{value}</T>
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-500">
              <T k="contact.note">{`${company.legalName} · Hoạt động tại ${company.area}`}</T>
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

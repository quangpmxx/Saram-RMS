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
    { key: "hotline", icon: Phone, label: "Hotline", value: company.hotlineDisplay || PENDING, href: company.hotline ? `tel:${company.hotline}` : "" },
    { key: "zalo", icon: MessageCircle, label: "Zalo", value: company.hotlineDisplay || PENDING, href: company.zalo ? `https://zalo.me/${company.zalo}` : "" },
    { key: "email", icon: Mail, label: "Email", value: company.email || PENDING, href: company.email ? `mailto:${company.email}` : "" },
    {
      key: "address",
      icon: MapPin,
      label: "Địa chỉ",
      value: company.address || PENDING,
      href: company.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}` : "",
    },
  ];
  return (
    <>
      <PageHero
        k="contact.hero"
        eyebrow="Liên hệ"
        title="Nói chuyện với Đại Việt"
        text="Người lao động cần tìm việc hay nhà máy cần tuyển người — để lại thông tin, Đại Việt gọi lại ngay."
      />
      <section className="py-10 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {items.map(({ key, icon: Icon, label, value, href }) => (
                <li key={label}>
                  <a
                    href={href || undefined}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="flex h-full items-center gap-4 rounded-2xl border border-slate-200 p-4 transition-colors hover:border-brand sm:block sm:p-6"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand sm:h-auto sm:w-auto sm:place-items-start sm:bg-transparent">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                    </span>
                    <span className="block min-w-0">
                      <span className="block text-sm text-slate-500 sm:mt-4">
                        <T k={`contact.${key}.label`}>{label}</T>
                      </span>
                      <span className="mt-0.5 block font-semibold sm:mt-1">
                        <T k={`contact.${key}.value`}>{value}</T>
                      </span>
                    </span>
                  </a>
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

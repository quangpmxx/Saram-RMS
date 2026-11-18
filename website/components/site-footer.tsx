import Link from "next/link";
import type { ReactNode } from "react";
import { getCompany } from "@/lib/site";
import { T } from "./editable";
import { Logo } from "./ui";
import { AreasFooterList } from "./lists";

const PENDING = "Đang cập nhật";

export async function SiteFooter({ nav }: { nav: { href: string; label: ReactNode }[] }) {
  const company = await getCompany();
  return (
    <footer className="bg-ink text-slate-400">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">
            <T k="footer.about">{`${company.legalName} — cung ứng nhân lực cho các nhà máy tại KCN ${company.area} từ năm ${company.since}.`}</T>
          </p>
          <dl className="mt-5 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-slate-500">Hotline:</dt>
              <dd className="text-slate-200">{company.hotlineDisplay || PENDING}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-500">Địa chỉ:</dt>
              <dd className="text-slate-200">{company.address || PENDING}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-500">Mã số thuế:</dt>
              <dd className="text-slate-200">{company.taxCode || PENDING}</dd>
            </div>
          </dl>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            <T k="footer.pages">Trang</T>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            <T k="footer.areas">Khu vực hoạt động</T>
          </p>
          <AreasFooterList />
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          © {new Date().getFullYear()} {company.legalName}.{" "}
          <T k="footer.note">Người lao động không mất bất kỳ khoản phí nào khi tìm việc qua Đại Việt.</T>
        </p>
      </div>
    </footer>
  );
}

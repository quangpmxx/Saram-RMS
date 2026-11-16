import Link from "next/link";
import { company, nav, areas } from "@/lib/content";
import { Logo } from "./ui";

const PENDING = "Đang cập nhật";

export function SiteFooter() {
  return (
    <footer className="bg-ink text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">
            {company.legalName} — cung ứng nhân lực cho các nhà máy tại KCN {company.area} từ năm {company.since}.
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
          <p className="text-sm font-semibold text-white">Trang</p>
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
          <p className="text-sm font-semibold text-white">Khu vực hoạt động</p>
          <ul className="mt-4 space-y-2 text-sm">
            {areas.map((a) => (
              <li key={a.name}>
                KCN {a.name} <span className="text-slate-600">· {a.province}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          © {new Date().getFullYear()} {company.legalName}. Người lao động không mất bất kỳ khoản phí nào khi tìm việc qua Đại Việt.
        </p>
      </div>
    </footer>
  );
}

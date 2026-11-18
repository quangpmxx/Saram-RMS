import { MessageCircle, Phone } from "lucide-react";
import { getCompany } from "@/lib/site";

/**
 * Liên hệ nhanh — người lao động chủ yếu xem bằng điện thoại.
 * Điện thoại: thanh cố định ở đáy màn hình (Gọi ngay · Nhắn Zalo), luôn trong tầm ngón cái.
 * Máy tính: hai nút tròn nổi góc phải.
 */
export async function FloatingContact() {
  const company = await getCompany();
  const zaloHref = company.zalo ? `https://zalo.me/${company.zalo}` : "/lien-he";
  const telHref = company.hotline ? `tel:${company.hotline}` : "/lien-he";
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <a
          href={telHref}
          className="flex items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-semibold text-white active:bg-brand-dark"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          Gọi {company.hotlineDisplay}
        </a>
        <a
          href={zaloHref}
          className="flex items-center justify-center gap-2 rounded-full bg-[#0068ff] py-3 text-sm font-semibold text-white active:bg-[#0055d4]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Nhắn Zalo
        </a>
      </div>

      <div className="fixed right-4 bottom-4 z-40 hidden flex-col gap-3 sm:flex">
        <a
          href={zaloHref}
          className="grid h-13 w-13 place-items-center rounded-full bg-[#0068ff] text-white shadow-lg shadow-blue-900/30 transition-transform hover:scale-105"
          aria-label="Nhắn Zalo"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
        <a
          href={telHref}
          className="grid h-13 w-13 place-items-center rounded-full bg-brand text-white shadow-lg shadow-orange-900/30 transition-transform hover:scale-105"
          aria-label="Gọi hotline"
        >
          <Phone className="h-6 w-6" />
        </a>
      </div>
    </>
  );
}

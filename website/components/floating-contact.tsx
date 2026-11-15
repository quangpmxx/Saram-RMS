import { MessageCircle, Phone } from "lucide-react";
import { company } from "@/lib/content";

/** Nút gọi / Zalo nổi góc phải — người lao động chủ yếu xem bằng điện thoại. */
export function FloatingContact() {
  const zaloHref = company.zalo ? `https://zalo.me/${company.zalo}` : "/lien-he";
  const telHref = company.hotline ? `tel:${company.hotline}` : "/lien-he";
  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col gap-3">
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
  );
}

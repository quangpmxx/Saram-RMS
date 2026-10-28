"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { APP_SCROLL_CONTAINER_ID } from "./app-scroll-container";

/**
 * Yêu cầu người dùng (2026-10-28): mở 1 màn chi tiết rồi bấm "Quay lại"/
 * "Lưu thông tin" thì về ĐÚNG màn hình cũ (trang, tab, vị trí cuộn) — không
 * phải luôn nhảy về 1 trang cố định.
 *
 * `trail` = các URL trong app đã đi qua theo thứ tự (biến module, chỉ sống
 * trong tab hiện tại, mất khi tải lại trang/mở tab mới — khi đó không có
 * "trang trước" trong app, nơi gọi tự về trang mặc định). Không dựa vào
 * sự kiện popstate: Next xử lý Back và chạy xong effect trước listener
 * của mình — nhận ra "quay lại" bằng cách so URL mới với URL liền trước.
 */
const trail: string[] = [];
/** Vị trí cuộn của cột nội dung chính theo từng URL — khôi phục khi quay lại. */
const scrollByUrl = new Map<string, number>();

/**
 * Về màn hình trước đó trong app (router.back để giữ đúng lịch sử trình duyệt);
 * không có trang trước (mở thẳng link/tab mới/tải lại) thì về `fallback`.
 */
export function goBackInApp(router: { back: () => void; push: (href: string) => void }, fallback: string) {
  if (trail.length >= 2) router.back();
  else router.push(fallback);
}

/** URL hiện tại của trình duyệt, cùng định dạng với `url` của NavigationTracker. */
function browserUrl(): string {
  const search = new URLSearchParams(window.location.search);
  return `${window.location.pathname}${search.size ? `?${search.toString()}` : ""}`;
}

function scrollContainer(): HTMLElement | null {
  return document.getElementById(APP_SCROLL_CONTAINER_ID);
}

/** Gắn 1 lần trong layout dashboard — theo dõi URL + vị trí cuộn cột nội dung. */
export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;

  // Chụp vị trí cuộn của trang đang xem NGAY TRƯỚC khi rời trang — mọi lần
  // rời trang trong app đều bắt đầu từ 1 cú bấm (link, nút Lưu, thông
  // báo...). Không dùng sự kiện scroll vì lúc chuyển trang Next tự cuộn cột
  // nội dung trước khi URL đổi — sẽ ghi đè vị trí cũ bằng vị trí sai.
  useEffect(() => {
    function remember() {
      const el = scrollContainer();
      const current = trail[trail.length - 1];
      if (el && current === browserUrl()) scrollByUrl.set(current, el.scrollTop);
    }
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, []);

  useEffect(() => {
    if (url === trail[trail.length - 1]) return;
    const isBack = trail.length >= 2 && trail[trail.length - 2] === url;
    if (isBack) trail.pop();
    else trail.push(url);
    const restore = isBack ? scrollByUrl.get(url) : undefined;
    if (!restore) return;
    // Nội dung có thể chưa đủ cao ngay (đang tải dữ liệu), và Next có thể tự
    // cuộn thêm sau khi chuyển trang — giữ vị trí trong ~1 giây đầu.
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      const el = scrollContainer();
      if (!el) return;
      if (Math.abs(el.scrollTop - restore) > 2) el.scrollTop = restore;
      if (++tries < 12) timer = window.setTimeout(attempt, 100);
    };
    timer = window.setTimeout(attempt, 0);
    // Người dùng tự cuộn trong lúc đó thì thôi, không kéo ngược lại.
    const stop = () => window.clearTimeout(timer);
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchstart", stop, { once: true, passive: true });
    window.addEventListener("keydown", stop, { once: true });
    return () => {
      stop();
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [url]);

  return null;
}

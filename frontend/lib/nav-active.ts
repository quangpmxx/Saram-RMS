/**
 * Trang con thuộc về 1 mục menu nhưng KHÔNG nằm dưới đường dẫn của mục đó
 * (vd trang "Trùng lặp" /duplicates thuộc nhóm "Data lao động" /candidates).
 */
const NAV_EXTRA_PATHS: Record<string, string[]> = {
  "/candidates": ["/duplicates"],
};

/**
 * Mục menu `href` có đang được chọn ở đường dẫn `pathname` không. Khớp cả trang
 * con (vd /candidates/123, /attendance/checkin) để mục menu cha vẫn được tô màu —
 * trước đây chỉ khớp chính xác nên mở trang con là mất tô.
 */
export function isNavActive(pathname: string, href: string): boolean {
  const roots = [href, ...(NAV_EXTRA_PATHS[href] ?? [])];
  return roots.some((root) => pathname === root || (root !== "/" && pathname.startsWith(`${root}/`)));
}

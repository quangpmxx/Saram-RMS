import Image, { type ImageProps } from "next/image";
import { getTexts } from "@/lib/texts";

/**
 * Đoạn chữ sửa được tại chỗ (chế độ sửa). `k` là mã cố định của đoạn chữ — đừng đổi mã
 * khi đã có người sửa, kẻo mất bản đã sửa. Chữ trong `children` là chữ gốc.
 */
export async function T({ k, children }: { k: string; children: string }) {
  const texts = await getTexts();
  return (
    <span data-k={k} className="whitespace-pre-line">
      {texts[k] ?? children}
    </span>
  );
}

/**
 * Ảnh đổi được ở chế độ sửa. Ảnh đã đổi nằm ở CRM (/uploads/website/…), đi qua /api;
 * giá trị lạ (không phải ảnh tải lên) bị bỏ qua, dùng ảnh gốc.
 */
export async function EImage({ k, src, alt, ...rest }: { k: string; src: string; alt: string } & Omit<ImageProps, "src" | "alt">) {
  const texts = await getTexts();
  const custom = texts[k];
  const useCustom = typeof custom === "string" && /^\/uploads\/website\/[\w-]+\.(jpg|png|webp)$/.test(custom);
  return (
    <Image
      {...rest}
      src={useCustom ? `/api${custom}` : src}
      alt={alt}
      unoptimized={useCustom || rest.unoptimized}
      data-img-k={k}
    />
  );
}

import Image, { type ImageProps } from "next/image";
import { getTexts } from "@/lib/texts";
import {
  STYLE_SUFFIX,
  imageStyleCss,
  isUploadUrl,
  parseImageStyle,
  parseTextStyle,
  textStyleCss,
} from "@/lib/style";

/**
 * Đoạn chữ sửa được tại chỗ (chế độ sửa). `k` là mã cố định của đoạn chữ — đừng đổi mã
 * khi đã có người sửa, kẻo mất bản đã sửa. Chữ trong `children` là chữ gốc.
 * Kiểu chữ (cỡ, màu, đậm/nghiêng/gạch chân, căn lề, ẩn) lưu ở mã `<k>.__style`.
 */
export async function T({ k, children }: { k: string; children: string }) {
  const texts = await getTexts();
  const raw = texts[k + STYLE_SUFFIX];
  const style = parseTextStyle(raw);
  return (
    <span
      data-k={k}
      data-style={raw ? JSON.stringify(style) : undefined}
      data-hidden={style.hidden ? "" : undefined}
      className="whitespace-pre-line"
      style={textStyleCss(style)}
    >
      {texts[k] ?? children}
    </span>
  );
}

/**
 * Ảnh đổi được ở chế độ sửa. Ảnh đã đổi nằm ở CRM (/uploads/website/…), đi qua /api;
 * giá trị lạ (không phải ảnh tải lên) bị bỏ qua, dùng ảnh gốc.
 * Cách hiện ảnh (lấp đầy/vừa khung, vị trí, phóng to) lưu ở mã `<k>.__style`.
 */
export async function EImage({ k, src, alt, style, ...rest }: { k: string; src: string; alt: string } & Omit<ImageProps, "src" | "alt">) {
  const texts = await getTexts();
  const custom = texts[k];
  const useCustom = isUploadUrl(custom);
  const raw = texts[k + STYLE_SUFFIX];
  const imgStyle = parseImageStyle(raw);
  const css = Object.fromEntries(Object.entries(imageStyleCss(imgStyle)).filter(([, v]) => v));
  return (
    <Image
      {...rest}
      src={useCustom ? `/api${custom}` : src}
      alt={alt}
      unoptimized={useCustom || rest.unoptimized}
      style={{ ...style, ...css }}
      data-img-k={k}
      data-style={raw ? JSON.stringify(imgStyle) : undefined}
    />
  );
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 3, Mục
 * 5. Parse User-Agent thủ công bằng regex (không thêm dependency mới,
 * chưa có thư viện parse UA nào trong package.json) — chỉ nhận diện các hệ
 * điều hành/trình duyệt phổ biến nêu trong yêu cầu (Windows/macOS/Android/
 * iOS/iPadOS, Chrome/Safari/Edge/Firefox), không cố phủ hết mọi trường hợp.
 */
export interface ParsedUserAgent {
  device: string;
  operatingSystem: string;
  browser: string;
}

export function parseUserAgent(userAgent: string | undefined): ParsedUserAgent {
  const ua = userAgent ?? '';

  let operatingSystem = 'Không xác định';
  if (/iPad/i.test(ua)) operatingSystem = 'iPadOS';
  else if (/iPhone/i.test(ua)) operatingSystem = 'iOS';
  else if (/Android/i.test(ua)) operatingSystem = 'Android';
  else if (/Mac OS X/i.test(ua)) operatingSystem = 'macOS';
  else if (/Windows/i.test(ua)) operatingSystem = 'Windows';

  let device = 'Máy tính';
  if (/iPad/i.test(ua)) device = 'iPad';
  else if (/iPhone/i.test(ua)) device = 'iPhone';
  else if (/Android/i.test(ua))
    device = /Mobile/i.test(ua)
      ? 'Điện thoại Android'
      : 'Máy tính bảng Android';

  let browser = 'Không xác định';
  const edgeMatch = /Edg(?:A|iOS)?\/([\d.]+)/.exec(ua);
  const firefoxMatch = /(?:Firefox|FxiOS)\/([\d.]+)/.exec(ua);
  const chromeMatch = /(?:Chrome|CriOS)\/([\d.]+)/.exec(ua);
  const safariMatch = /Version\/([\d.]+).*Safari/.exec(ua);
  // Thứ tự ưu tiên: Edge/Firefox trước vì UA của chúng cũng chứa chuỗi
  // "Chrome"/"Safari" (dựa trên Chromium/WebKit) — kiểm tra chuỗi đặc trưng
  // riêng trước để không nhận nhầm thành Chrome/Safari.
  if (edgeMatch) browser = `Edge ${edgeMatch[1]}`;
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1]}`;
  else if (chromeMatch) browser = `Chrome ${chromeMatch[1]}`;
  else if (safariMatch) browser = `Safari ${safariMatch[1]}`;

  return { device, operatingSystem, browser };
}

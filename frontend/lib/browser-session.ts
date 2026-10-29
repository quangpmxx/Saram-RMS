"use client";

import { useEffect } from "react";
import { clientApi } from "./api-client";

/**
 * Yêu cầu người dùng (2026-10-29): tắt máy/tắt trình duyệt rồi mở lại thì
 * phải đăng nhập lại (phiên vẫn có hạn 7 ngày nếu trình duyệt còn mở).
 *
 * Cookie phiên không đặt thời hạn (mất khi đóng trình duyệt), nhưng Edge/
 * Chrome bật "tiếp tục từ nơi đã dừng" sẽ khôi phục cả cookie đó — không
 * dựa vào cookie được. Thay vào đó mỗi tab đang mở app ghi "còn sống" vào
 * localStorage định kỳ; tải trang mà lần ghi gần nhất đã quá STALE_MS (không
 * còn tab nào mở) thì coi là trình duyệt vừa mở lại → đăng xuất.
 *
 * STALE_MS phải lớn hơn chu kỳ tối đa của tab nền: trình duyệt hạn chế
 * timer của tab ẩn lâu còn ~1 lần/phút.
 */
const ALIVE_KEY = "saram_rms_alive_at";
const HEARTBEAT_MS = 15_000;
const STALE_MS = 3 * 60_000;

function readAliveAt(): number | null {
  try {
    const value = Number(window.localStorage.getItem(ALIVE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Đánh dấu trình duyệt đang mở app — gọi ngay khi đăng nhập thành công. */
export function markBrowserSessionAlive() {
  try {
    window.localStorage.setItem(ALIVE_KEY, String(Date.now()));
  } catch {
    // localStorage bị chặn (chế độ riêng tư...) — bỏ qua, không chặn đăng nhập.
  }
}

function storageAvailable(): boolean {
  try {
    window.localStorage.getItem(ALIVE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Gắn 1 lần trong layout dashboard. */
export function BrowserSessionGuard() {
  useEffect(() => {
    // Không đọc/ghi được localStorage thì không kiểm tra được — không đăng
    // xuất nhầm, chỉ còn hạn 7 ngày của phiên.
    if (!storageAvailable()) return;

    const aliveAt = readAliveAt();
    if (aliveAt === null || Date.now() - aliveAt > STALE_MS) {
      void clientApi("/logout", { method: "POST" })
        .catch(() => undefined)
        .finally(() => window.location.replace("/login"));
      return;
    }

    markBrowserSessionAlive();
    const timer = window.setInterval(markBrowserSessionAlive, HEARTBEAT_MS);
    // Tải lại trang/quay lại tab sau khi máy ngủ: ghi ngay để không bị coi là "đã đóng".
    const onVisible = () => {
      if (document.visibilityState === "visible") markBrowserSessionAlive();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", markBrowserSessionAlive);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", markBrowserSessionAlive);
    };
  }, []);

  return null;
}

import { clientApi } from "./api-client";

/**
 * Thông báo đẩy ra điện thoại/máy tính (Web Push, 2026-11-06) — bật/tắt cho
 * ĐÚNG máy đang dùng. Chương trình chạy ngầm: public/sw.js; máy chủ: backend/src/push.
 */

export type PushState =
  | "insecure" // mở bằng http:// (không phải https/localhost) → trình duyệt tắt hẳn tính năng
  | "unsupported" // trình duyệt không hỗ trợ
  | "ios-needs-install" // iPhone/iPad: phải "Thêm vào MH chính" rồi mở từ biểu tượng
  | "server-off" // máy chủ chưa cấu hình khoá
  | "denied" // người dùng đã chặn quyền thông báo
  | "off"
  | "on";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function getPublicKey(): Promise<string | null> {
  const result = await clientApi<{ public_key: string | null }>("/push/public-key");
  return result.public_key;
}

export async function getPushState(): Promise<PushState> {
  if (!window.isSecureContext) return "insecure";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos() && !isStandalone() ? "ios-needs-install" : "unsupported";
  if (isIos() && !isStandalone()) return "ios-needs-install";
  if (!(await getPublicKey())) return "server-off";
  if (Notification.permission === "denied") return "denied";
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && Notification.permission === "granted") {
    // Gửi lại cho chắc máy chủ vẫn lưu đúng tài khoản đang đăng nhập trên máy này.
    await clientApi("/push/subscribe", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
    return "on";
  }
  return "off";
}

/** Bật: xin quyền (phải gọi từ cú bấm của người dùng) → đăng ký → gửi lên máy chủ. */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const publicKey = await getPublicKey();
  if (!publicKey) return "server-off";
  const registration = await getRegistration();
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await clientApi("/push/subscribe", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await clientApi("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(
      () => undefined,
    );
    await subscription.unsubscribe();
  }
  return "off";
}

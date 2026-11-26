"use client";

import { useEffect, useState } from "react";
import { MicOff } from "lucide-react";
import { useToast } from "@/lib/toast-context";

/**
 * Nút cấp quyền micro cạnh chuông thông báo (2026-11-26, yêu cầu người dùng: lỡ bấm "Chặn" ở app
 * cài trên máy, không biết bật lại ở đâu). Chỉ hiện khi CHƯA có quyền; bấm → trình duyệt hỏi lại.
 * Đã bị chặn hẳn thì trình duyệt không hỏi nữa → hướng dẫn mở lại trong cài đặt.
 */
export function MicPermissionButton({ enabled }: { enabled: boolean }) {
  const toast = useToast();
  // null = chưa biết (chưa kiểm xong) → chưa hiện, tránh nháy nút.
  const [state, setState] = useState<PermissionState | "unknown" | null>(null);

  useEffect(() => {
    if (!enabled || !navigator.mediaDevices?.getUserMedia) return;
    let status: PermissionStatus | null = null;
    const onChange = () => status && setState(status.state);
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((s) => {
        status = s;
        setState(s.state);
        s.addEventListener("change", onChange);
      })
      // Trình duyệt không hỗ trợ kiểm quyền → vẫn hiện nút để bấm thử.
      .catch(() => setState("unknown"));
    if (!navigator.permissions) Promise.resolve().then(() => setState("unknown"));
    return () => status?.removeEventListener("change", onChange);
  }, [enabled]);

  if (!enabled || state === null || state === "granted") return null;

  async function request() {
    if (!window.isSecureContext) {
      toast.warning("Trang đang mở bằng http nên không dùng được micro. Hãy mở bằng địa chỉ https.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setState("granted");
      toast.success("Đã bật micro — giờ có thể nói chuyện với Trợ lý AI");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotFoundError") {
        toast.error("Không tìm thấy micro trên máy. Kiểm tra lại micro / tai nghe.");
      } else {
        toast.warning(
          "Micro đang bị chặn nên trình duyệt không hỏi lại được. Bấm biểu tượng ổ khoá (hoặc ⋮) cạnh địa chỉ / tiêu đề app → Cài đặt trang web → Micrô → Cho phép, rồi mở lại app.",
        );
      }
    }
  }

  return (
    <button
      type="button"
      title="Bật quyền micro cho Trợ lý AI"
      aria-label="Bật quyền micro"
      onClick={() => void request()}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg text-amber-500 transition-colors hover:bg-amber-50 hover:text-amber-600"
    >
      <MicOff className="h-4.5 w-4.5" strokeWidth={2} />
    </button>
  );
}

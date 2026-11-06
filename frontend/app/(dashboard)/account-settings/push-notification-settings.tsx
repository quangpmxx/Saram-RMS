"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Share, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/toast-context";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";

/**
 * Cài đặt tài khoản → "Thông báo nổi" (2026-11-06): bật/tắt thông
 * báo nổi cho ĐÚNG máy đang dùng — nhận được cả khi đã tắt màn hình/đóng web.
 * Mỗi máy (điện thoại, máy tính) bật riêng 1 lần.
 */
export function PushNotificationSettings() {
  const [state, setState] = useState<PushState | "loading" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    getPushState()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorText(error instanceof Error ? error.message : String(error));
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      const next = on ? await enablePush() : await disablePush();
      setState(next);
      if (next === "on") toast.success("Đã bật thông báo trên máy này");
      else if (!on) toast.success("Đã tắt thông báo trên máy này");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
      toast.error("Không bật được thông báo trên máy này, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">Thông báo nổi</h3>

      <div className="mt-3">
        {state === "loading" && <p className="text-sm text-slate-400">Đang kiểm tra...</p>}

        {state === "on" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              <BellRing className="h-4 w-4" strokeWidth={2} />
              Đang bật trên máy này
            </span>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void toggle(false)}>
              <BellOff className="h-3.5 w-3.5" strokeWidth={2} />
              Tắt
            </Button>
          </div>
        )}

        {state === "off" && (
          <Button type="button" size="sm" disabled={busy} onClick={() => void toggle(true)}>
            <BellRing className="h-3.5 w-3.5" strokeWidth={2} />
            {busy ? "Đang bật..." : "Bật thông báo trên máy này"}
          </Button>
        )}

        {state === "ios-needs-install" && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">iPhone/iPad: cần thêm web vào màn hình chính trước</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs">
              <li>
                Mở trang này bằng <b>Safari</b>, bấm nút Chia sẻ{" "}
                <Share className="inline h-3.5 w-3.5 align-text-bottom" strokeWidth={2} />.
              </li>
              <li>
                Chọn <b>Thêm vào MH chính</b> <PlusSquare className="inline h-3.5 w-3.5 align-text-bottom" strokeWidth={2} />.
              </li>
              <li>Mở Saram CRM từ biểu tượng trên màn hình chính, vào lại trang này rồi bấm <b>Bật thông báo</b>.</li>
            </ol>
            <p className="mt-1.5 text-xs">Cần iOS 16.4 trở lên.</p>
          </div>
        )}

        {state === "denied" && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Máy này đang <b>chặn</b> thông báo của trang. Vào Cài đặt của trình duyệt/điện thoại, cho phép thông báo cho
            Saram CRM, rồi tải lại trang này.
          </p>
        )}

        {state === "server-off" && (
          <p className="text-sm text-slate-500">Máy chủ chưa bật tính năng này. Vui lòng báo Admin.</p>
        )}

        {state === "insecure" && (
          <p className="text-sm text-slate-500">
            Trang đang mở bằng địa chỉ <b>http://</b> nên trình duyệt chặn thông báo đẩy. Hãy mở bằng địa chỉ{" "}
            <b>https://</b> (hoặc <b>localhost</b> khi thử trên máy dev).
          </p>
        )}

        {state === "error" && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Không kiểm tra được thông báo trên máy này.</p>
        )}

        {errorText && <p className="mt-2 text-xs break-words text-slate-400">Chi tiết lỗi: {errorText}</p>}

        {state === "unsupported" && (
          <p className="text-sm text-slate-500">
            Trình duyệt này không hỗ trợ thông báo đẩy. Hãy dùng Chrome (Android/máy tính) hoặc Safari (iPhone, thêm vào
            màn hình chính).
          </p>
        )}
      </div>
    </section>
  );
}

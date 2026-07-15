"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Fingerprint, Loader2 } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { reverseGeocode } from "@/lib/geocode";
import type { Account, CheckinRecordStatus, CheckinStatus } from "@/lib/types";
import { ACCOUNT_ROLE_LABEL } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";

function formatDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("vi-VN", { hour12: false });
}

const STATUS_META: Record<CheckinRecordStatus, { label: string; bg: string; text: string }> = {
  valid: { label: "Hợp lệ — Công ty", bg: "bg-emerald-50", text: "text-emerald-700" },
  outside_company: { label: "Ngoài công ty", bg: "bg-amber-50", text: "text-amber-700" },
  needs_verification: { label: "Cần xác minh — GPS độ chính xác thấp", bg: "bg-orange-50", text: "text-orange-700" },
};

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

type GpsState = "idle" | "requesting" | "granted" | "denied";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 1+2.
 * IP/thiết bị/trình duyệt (Phase 3), reset (Phase 4) sẽ bổ sung vào ĐÚNG
 * trang này ở các Phase sau, không tạo trang riêng.
 */
export function CheckinClient({ user }: { user: Account }) {
  useSetPageTitle("Check in", "Chấm công bằng vị trí GPS.");
  const toast = useToast();
  const router = useRouter();

  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Đồng hồ hiển thị chạy realtime nhưng CĂN CHỈNH theo giờ server (Mục 2,
  // yêu cầu người dùng: "thời gian lưu phải lấy từ server, không tin thời
  // gian trên thiết bị người dùng") — lệch offset đo 1 lần lúc tải trạng
  // thái, sau đó cộng dồn vào Date.now() cục bộ để chạy mượt mỗi giây.
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [now, setNow] = useState<Date>(new Date());

  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  const [devLat, setDevLat] = useState("");
  const [devLng, setDevLng] = useState("");
  const [devAccuracy, setDevAccuracy] = useState("15");

  useEffect(() => {
    let cancelled = false;
    clientApi<CheckinStatus>("/checkin/status")
      .then((result) => {
        if (cancelled) return;
        setStatus(result);
        setServerOffsetMs(new Date(result.server_time).getTime() - Date.now());
      })
      .catch((error) => {
        if (cancelled) return;
        setStatusError(error instanceof ApiError ? error.message : "Không tải được trạng thái Check in");
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date(Date.now() + serverOffsetMs)), 1000);
    return () => clearInterval(interval);
  }, [serverOffsetMs]);

  const checkedInRecord = status?.today_record ?? null;
  const companyConfigured = status?.company_location_configured ?? false;
  const canAttemptGps = !loadingStatus && !statusError && !checkedInRecord && companyConfigured;

  // Mục 3, yêu cầu người dùng: "Khi mở trang: Yêu cầu quyền truy cập GPS...
  // dùng chế độ độ chính xác cao" — tự động xin quyền ngay khi đủ điều
  // kiện (không cần bấm nút), CHỈ khi chưa Check in và đã có cấu hình công
  // ty (không hỏi quyền vô ích nếu không thể Check in được nữa).
  useEffect(() => {
    if (!canAttemptGps || gpsState !== "idle") return;
    if (!navigator.geolocation) {
      queueMicrotask(() => {
        setGpsState("denied");
        setGpsError("Trình duyệt không hỗ trợ lấy vị trí GPS");
      });
      return;
    }
    queueMicrotask(() => {
      setGpsState("requesting");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setGpsState("granted");
        },
        () => {
          setGpsState("denied");
          setGpsError("Không lấy được vị trí — vui lòng bật quyền truy cập vị trí cho trình duyệt trong Cài đặt hệ thống rồi tải lại trang.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }, [canAttemptGps, gpsState]);

  // Có tọa độ (thật hoặc giả lập dev) -> tra địa chỉ để gửi kèm lúc Check in
  // (Mục 6: resolved_address lưu tham khảo cho Admin xem, KHÔNG hiển thị ở
  // đây nữa — yêu cầu trực tiếp người dùng, 2026-07-15: "không cần hiển thị
  // những thông tin này khi nhân viên chấm công").
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    reverseGeocode(coords.latitude, coords.longitude).then((address) => {
      if (!cancelled) setResolvedAddress(address);
    });
    return () => {
      cancelled = true;
    };
  }, [coords]);

  const roleLabel = useMemo(() => user.position ?? ACCOUNT_ROLE_LABEL[user.role], [user.position, user.role]);

  function handleUseSimulatedCoords() {
    const lat = Number(devLat);
    const lng = Number(devLng);
    const accuracy = Number(devAccuracy);
    if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(accuracy)) {
      toast.warning("Vui lòng nhập đủ Latitude/Longitude/Accuracy hợp lệ");
      return;
    }
    setGpsError(null);
    setGpsState("granted");
    setCoords({ latitude: lat, longitude: lng, accuracy });
  }

  async function handleConfirmCheckin() {
    if (!coords) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const record = await clientApi<CheckinStatus["today_record"]>("/checkin", {
        method: "POST",
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          resolved_address: resolvedAddress ?? undefined,
        }),
      });
      setStatus((prev) => ({
        checked_in_today: true,
        today_record: record,
        server_time: prev?.server_time ?? new Date().toISOString(),
        company_location_configured: prev?.company_location_configured ?? true,
        ip_address: prev?.ip_address ?? null,
        device: prev?.device ?? "",
        operating_system: prev?.operating_system ?? "",
        browser: prev?.browser ?? "",
      }));
      toast.success("Check in thành công");
      // Yêu cầu trực tiếp người dùng (2026-07-15): "Sau khi nhân viên đã
      // check in xong thì tự out ra màn hình chính" — giữ lại 1.5s để nhân
      // viên còn kịp thấy xác nhận "Đã Check in hôm nay" trước khi rời trang.
      setTimeout(() => router.push("/"), 1500);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm = Boolean(coords) && companyConfigured && !checkedInRecord && !submitting;

  return (
    <div className="mx-auto max-w-xl">
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Avatar fullName={user.full_name} avatarUrl={user.avatar_url} className="h-20 w-20 text-2xl" />
          <div>
            <p className="text-lg font-semibold text-slate-900">{user.full_name}</p>
            <p className="text-sm text-slate-500">
              {roleLabel}
              {user.team_name ? ` · ${user.team_name}` : ""}
            </p>
          </div>

          <div className="w-full rounded-xl bg-slate-50 py-4">
            <p className="text-sm text-slate-500 capitalize">{formatDate(now)}</p>
            <p className="font-mono text-3xl font-semibold tracking-wider text-slate-900">{formatTime(now)}</p>
          </div>

          {loadingStatus ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Đang tải trạng thái Check in...
            </div>
          ) : statusError ? (
            <p role="alert" className="text-sm text-red-600">
              {statusError}
            </p>
          ) : checkedInRecord ? (
            <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-emerald-50 py-5 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" strokeWidth={2} />
              <p className="font-semibold">Đã Check in hôm nay</p>
              <p className="text-sm">Lúc {formatTime(new Date(checkedInRecord.checked_in_at))}</p>
              <p className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_META[checkedInRecord.status].bg} ${STATUS_META[checkedInRecord.status].text}`}>
                {STATUS_META[checkedInRecord.status].label}
              </p>
            </div>
          ) : !companyConfigured ? (
            <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-amber-50 py-5 text-amber-700">
              <AlertTriangle className="h-6 w-6" strokeWidth={2} />
              <p className="font-medium">Quản trị viên chưa thiết lập vị trí công ty</p>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-3 text-left">
              {/* Trạng thái lấy vị trí — yêu cầu trực tiếp người dùng
                  (2026-07-15): "Không cần hiển thị những thông tin này khi
                  nhân viên chấm công" — CHỈ hiện khi đang xin quyền hoặc bị
                  từ chối (thông tin nhân viên cần biết để xử lý), KHÔNG hiện
                  gì khi đã lấy được vị trí thành công (im lặng, nút Xác nhận
                  tự bật). Vẫn giữ lại việc LẤY + LƯU tọa độ/địa chỉ/IP/thiết
                  bị ở nền cho Admin xem, chỉ ẩn khỏi giao diện nhân viên. */}
              {gpsState !== "granted" && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  {gpsState === "requesting" && (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" strokeWidth={2} />
                      <span className="text-slate-600">Đang lấy vị trí GPS...</span>
                    </>
                  )}
                  {gpsState === "denied" && (
                    <>
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2} />
                      <span className="text-red-600">{gpsError}</span>
                    </>
                  )}
                  {gpsState === "idle" && <span className="text-slate-400">Đang chuẩn bị lấy vị trí...</span>}
                </div>
              )}

              {process.env.NODE_ENV !== "production" && (
                <details className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium">🧪 Chế độ test (dev) — giả lập tọa độ GPS</summary>
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Latitude" uiSize="xs">
                        <Input uiSize="xs" value={devLat} onChange={(e) => setDevLat(e.target.value)} placeholder="10.7769" />
                      </Field>
                      <Field label="Longitude" uiSize="xs">
                        <Input uiSize="xs" value={devLng} onChange={(e) => setDevLng(e.target.value)} placeholder="106.7008" />
                      </Field>
                      <Field label="Accuracy (m)" uiSize="xs">
                        <Input uiSize="xs" value={devAccuracy} onChange={(e) => setDevAccuracy(e.target.value)} placeholder="15" />
                      </Field>
                    </div>
                    <Button type="button" variant="outline" size="xs" onClick={handleUseSimulatedCoords} className="self-start">
                      Dùng tọa độ giả lập
                    </Button>
                  </div>
                </details>
              )}

              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!canConfirm}
                onClick={() => void handleConfirmCheckin()}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Fingerprint className="h-4 w-4" strokeWidth={2} />}
                Xác nhận Check in
              </Button>
              {submitError && (
                <p role="alert" className="text-sm text-red-600">
                  {submitError}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

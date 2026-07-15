"use client";

import { useEffect, useState } from "react";
import { LocateFixed, MapPinned, Search } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { CompanyLocation } from "@/lib/types";
import { forwardGeocode, reverseGeocode } from "@/lib/geocode";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 2, Mục
 * 7: "Cài đặt Check in" trong trang Cài đặt tài khoản, CHỈ Admin thấy/sửa
 * (kiểm tra ở account-settings-client.tsx nơi render component này, backend
 * kiểm tra lại lần nữa ở checkin.service.ts).
 */

export function CheckinLocationSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("100");
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<{ at: string; by: string } | null>(null);

  useEffect(() => {
    clientApi<CompanyLocation | null>("/checkin/company-location")
      .then((config) => {
        if (!config) return;
        setAddress(config.address);
        setLatitude(String(config.latitude));
        setLongitude(String(config.longitude));
        setRadius(String(config.allowed_radius_meters));
        setLastUpdated({ at: config.updated_at, by: config.updated_by_name });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không tải được cấu hình"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!latitude || !longitude || Number.isNaN(lat) || Number.isNaN(lng)) {
      queueMicrotask(() => setPreviewAddress(null));
      return;
    }
    queueMicrotask(() => setPreviewLoading(true));
    const timeout = setTimeout(() => {
      void reverseGeocode(lat, lng)
        .then(setPreviewAddress)
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => clearTimeout(timeout);
  }, [latitude, longitude]);

  async function handleSearchAddress() {
    if (!address.trim()) {
      setError("Vui lòng nhập địa chỉ trước khi tìm tọa độ");
      return;
    }
    setError(null);
    setSearching(true);
    try {
      const result = await forwardGeocode(address.trim());
      if (!result) {
        setError("Không tìm được tọa độ từ địa chỉ này, vui lòng nhập tay Latitude/Longitude");
        return;
      }
      setLatitude(String(result.lat));
      setLongitude(String(result.lng));
      toast.success("Đã tìm được tọa độ từ địa chỉ");
    } finally {
      setSearching(false);
    }
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ lấy vị trí GPS");
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocating(false);
        toast.success("Đã lấy vị trí hiện tại");
      },
      () => {
        setError("Không lấy được vị trí hiện tại — vui lòng cho phép quyền truy cập vị trí");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function handleSave() {
    setError(null);
    const lat = Number(latitude);
    const lng = Number(longitude);
    const radiusNum = Number(radius);

    if (!address.trim()) {
      setError("Vui lòng nhập địa chỉ công ty");
      return;
    }
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      setError("Latitude phải là số từ -90 đến 90");
      return;
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      setError("Longitude phải là số từ -180 đến 180");
      return;
    }
    if (!Number.isInteger(radiusNum) || radiusNum <= 0) {
      setError("Bán kính hợp lệ phải là số nguyên lớn hơn 0");
      return;
    }

    setSaving(true);
    try {
      const saved = await clientApi<CompanyLocation>("/checkin/company-location", {
        method: "PUT",
        body: JSON.stringify({
          address: address.trim(),
          latitude: lat,
          longitude: lng,
          allowed_radius_meters: radiusNum,
        }),
      });
      setLastUpdated({ at: saved.updated_at, by: saved.updated_by_name });
      toast.success("Đã lưu cấu hình vị trí công ty");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Đang tải cấu hình Check in...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Địa chỉ công ty">
        <div className="flex gap-2">
          <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" />
          <Button type="button" variant="outline" size="sm" disabled={searching} onClick={() => void handleSearchAddress()}>
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
            {searching ? "Đang tìm..." : "Tìm tọa độ"}
          </Button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude">
          <Input value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="10.776889" inputMode="decimal" />
        </Field>
        <Field label="Longitude">
          <Input value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="106.700806" inputMode="decimal" />
        </Field>
      </div>

      <Field label="Bán kính hợp lệ (m)" hint="Mặc định 100m — trong bán kính này tính là 'Hợp lệ'.">
        <Input value={radius} onChange={(event) => setRadius(event.target.value)} inputMode="numeric" />
      </Field>

      <Button type="button" variant="outline" size="sm" disabled={locating} onClick={handleUseCurrentLocation} className="self-start">
        <LocateFixed className="h-3.5 w-3.5" strokeWidth={2} />
        {locating ? "Đang lấy vị trí..." : "Dùng vị trí hiện tại"}
      </Button>

      {(previewLoading || previewAddress) && (
        <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {previewLoading ? "Đang tra địa chỉ từ tọa độ..." : previewAddress}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {lastUpdated && (
        <p className="text-xs text-slate-400">
          Cập nhật gần nhất: {new Date(lastUpdated.at).toLocaleString("vi-VN")} bởi {lastUpdated.by}
        </p>
      )}

      <Button type="button" disabled={saving} onClick={() => void handleSave()} className="self-end">
        {saving ? "Đang lưu..." : "Lưu cấu hình vị trí"}
      </Button>
    </div>
  );
}

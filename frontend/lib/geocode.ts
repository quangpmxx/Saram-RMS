/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 2.
 * Reverse/forward geocoding dùng Nominatim (OpenStreetMap) — dịch vụ bản đồ
 * miễn phí, không cần API key (hệ thống chưa có tích hợp bản đồ trả phí
 * nào trước đó). Dùng chung cho trang Check in (reverse) và Cài đặt Check
 * in của Admin (forward + reverse preview).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

export async function forwardGeocode(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (data.length === 0) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name };
  } catch {
    return null;
  }
}

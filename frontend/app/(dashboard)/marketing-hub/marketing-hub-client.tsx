"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api-client";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { computeDateRange, type DateRangeValue } from "@/lib/date-range";

interface AdItem {
  id: string;
  owner: { id: string; full_name: string };
  name: string;
  platform: "facebook" | "tiktok";
  total_spend: number;
  status: "connected" | "error" | "disconnected";
  synced: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  mkt_source: { id: string; name: string } | null;
  account_health: "live" | "unpaid" | "die" | null;
  has_active_campaign: boolean | null;
}
interface CostThresholds {
  green_max: number;
  red_min: number;
}
interface Overview {
  from: string;
  to: string;
  cost_thresholds: CostThresholds | null;
  data_by_owner: Record<string, number>;
  data_total: number;
  total_spend: number;
  has_synced_data: boolean;
  lead_total: number;
  items: AdItem[];
}
interface StaffOption {
  id: string;
  full_name: string;
  role: string;
  status: string;
}
interface ConnectResult {
  connected: number;
  skipped: { name: string; reason: string }[];
}

const PLATFORM_LABEL = { facebook: "Facebook", tiktok: "TikTok" } as const;
const STATUS_LABEL = { connected: "Đã kết nối", error: "Lỗi kết nối", disconnected: "Đã gỡ" } as const;
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} ₫`;
const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Có lỗi xảy ra");
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/**
 * Marketing Hub — bảng tổng quan tài khoản quảng cáo. Chỉ hiển thị chi tiêu thật đã
 * đồng bộ từ Facebook (tài khoản chưa đồng bộ hiện "—"); không có chi phí/data theo nhân viên.
 */
export function MarketingHubClient({ role, userId }: { role: string; userId: string }) {
  useSetPageTitle("Marketing Hub", "Tài khoản quảng cáo và chi tiêu");
  const toast = useToast();
  const isAdmin = role === "admin";
  const canConnect = isAdmin || role === "mkt";

  const [date, setDate] = useState<DateRangeValue>(() => ({ preset: "30d", ...computeDateRange("30d") }));
  // "Tối đa" (from/to rỗng) → lấy từ mốc rất sớm đến hôm nay.
  const from = date.from || "2000-01-01";
  const to = date.to || today();
  const [platform, setPlatform] = useState("");
  const [accountId, setAccountId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [allItems, setAllItems] = useState<AdItem[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [showMktSources, setShowMktSources] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [mktSources, setMktSources] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ from, to });
    if (platform) q.set("platform", platform);
    if (accountId) q.set("ad_account_id", accountId);
    if (ownerId) q.set("owner_id", ownerId);
    try {
      setData(await clientApi<Overview>(`/marketing-hub/overview?${q}`));
    } catch (e) {
      toast.error(errorText(e));
    }
  }, [from, to, platform, accountId, ownerId, toast]);

  useEffect(() => {
    // setTimeout(0): quy ước dự án cho setState đầu effect (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Danh sách đầy đủ (không lọc) để đổ vào ô lọc "Tài khoản" / "Nhân viên".
  useEffect(() => {
    clientApi<Overview>("/marketing-hub/overview")
      .then((r) => setAllItems(r.items))
      .catch(() => {});
    if (isAdmin) {
      clientApi<{ items: StaffOption[] }>("/account?page=1&page_size=100")
        .then((r) =>
          setStaff(r.items.filter((a) => a.status === "active" && ["admin", "manager", "mkt"].includes(a.role))),
        )
        .catch(() => {});
    }
  }, [isAdmin]);

  // Danh mục Nguồn MKT cho ô gắn nguồn (Admin); tải lại khi đóng hộp sửa nguồn.
  useEffect(() => {
    if (!isAdmin || showMktSources) return;
    clientApi<{ id: string; name: string }[]>("/marketing-hub/mkt-sources")
      .then(setMktSources)
      .catch(() => {});
  }, [isAdmin, showMktSources]);

  async function act(id: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  const owners = [...new Map(allItems.map((i) => [i.owner.id, i.owner.full_name])).entries()];

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-1.5 p-2">
        <Field uiSize="xs" label="Ngày" className="w-40">
          <DateRangePicker value={date} onChange={setDate} />
        </Field>
        <Field uiSize="xs" label="Nền tảng" className="w-28">
          <Select uiSize="xs" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
          </Select>
        </Field>
        <Field uiSize="xs" label="Tài khoản" className="w-40">
          <Select uiSize="xs" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Tất cả</option>
            {allItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field uiSize="xs" label="Nhân viên" className="w-40">
          <Select uiSize="xs" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Tất cả</option>
            {owners.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        {isAdmin && (
          <>
            <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={() => setShowThresholds(true)}>
              Ngưỡng giá số
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => setShowMktSources(true)}>
              Nguồn MKT
            </Button>
          </>
        )}
        {canConnect && (
          <Button type="button" size="xs" className={isAdmin ? "" : "ml-auto"} onClick={() => setShowConnect(true)}>
            Liên kết Facebook
          </Button>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs text-slate-500">Tổng chi tiêu quảng cáo</p>
          <p className="text-xl font-semibold text-slate-800">{data?.has_synced_data ? vnd(data.total_spend) : "—"}</p>
          {data && !data.has_synced_data && (
            <p className="text-xs text-amber-600">Chưa có tài khoản nào đồng bộ dữ liệu</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs text-slate-500">Data thu được (toàn công ty, theo ngày up)</p>
          <p className="text-xl font-semibold text-slate-800">{data ? data.lead_total.toLocaleString("vi-VN") : "—"}</p>
        </div>
      </div>

      {data && <EfficiencyTable data={data} />}

      <h2 className="pt-2 text-sm font-semibold text-slate-700">Tài khoản quảng cáo</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-left text-xs font-semibold text-white">
            <tr>
              <th className="px-3 py-2">Nhân viên phụ trách</th>
              <th className="px-3 py-2">Tài khoản quảng cáo</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Nguồn MKT</th>
              <th className="px-3 py-2 text-right">Tổng chi tiêu</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((i) => {
              const mine = isAdmin || i.owner.id === userId;
              const ownerOptions = [
                ...new Map<string, string>([[i.owner.id, i.owner.full_name], ...staff.map((s) => [s.id, s.full_name] as [string, string])]),
              ];
              return (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <Select
                        value={i.owner.id}
                        disabled={busyId === i.id}
                        onChange={(e) =>
                          void act(
                            i.id,
                            () =>
                              clientApi(`/marketing-hub/ad-accounts/${i.id}/owner`, {
                                method: "PATCH",
                                body: JSON.stringify({ owner_id: e.target.value }),
                              }),
                            "Đã đổi nhân viên phụ trách",
                          )
                        }
                      >
                        {ownerOptions.map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      i.owner.full_name
                    )}
                  </td>
                  <td className="px-3 py-2">{i.name}</td>
                  <td className="px-3 py-2">{PLATFORM_LABEL[i.platform]}</td>
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <Select
                        value={i.mkt_source?.id ?? ""}
                        disabled={busyId === i.id}
                        onChange={(e) =>
                          void act(
                            i.id,
                            () =>
                              clientApi(`/marketing-hub/ad-accounts/${i.id}/mkt-source`, {
                                method: "PATCH",
                                body: JSON.stringify({ mkt_source_id: e.target.value || null }),
                              }),
                            "Đã gắn nguồn MKT",
                          )
                        }
                      >
                        <option value="">— Chưa gắn —</option>
                        {mktSources.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </Select>
                    ) : (
                      (i.mkt_source?.name ?? <span className="text-slate-400">Chưa gắn</span>)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{i.synced ? vnd(i.total_spend) : "—"}</td>
                  <td className="px-3 py-2">
                    <span className={i.status === "connected" ? "text-emerald-600" : "text-red-600"}>
                      {STATUS_LABEL[i.status]}
                    </span>
                    <div className="text-xs text-slate-400">
                      {i.synced ? `Đồng bộ: ${new Date(i.last_sync_at!).toLocaleString("vi-VN")}` : "Chưa đồng bộ"}
                    </div>
                    {i.last_error && <div className="text-xs text-red-500">{i.last_error}</div>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {mine && canConnect && i.status !== "disconnected" && (
                      <>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={busyId === i.id}
                          onClick={() =>
                            void act(i.id, () => clientApi(`/marketing-hub/ad-accounts/${i.id}/sync`, { method: "POST" }), "Đã đồng bộ")
                          }
                        >
                          Đồng bộ
                        </Button>{" "}
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={busyId === i.id}
                          onClick={() => {
                            if (confirm(`Gỡ liên kết "${i.name}"? Token sẽ bị xoá.`))
                              void act(i.id, () => clientApi(`/marketing-hub/ad-accounts/${i.id}`, { method: "DELETE" }), "Đã gỡ liên kết");
                          }}
                        >
                          Gỡ
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  Chưa có tài khoản quảng cáo nào được liên kết
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onDone={load} />}
      {showMktSources && <MktSourcesModal onClose={() => setShowMktSources(false)} />}
      {showThresholds && (
        <ThresholdsModal initial={data?.cost_thresholds ?? null} onClose={() => setShowThresholds(false)} onDone={load} />
      )}
    </div>
  );
}

const HEALTH = {
  live: { label: "Live ADS", cls: "text-emerald-600" },
  unpaid: { label: "Chưa thanh toán", cls: "text-amber-600" },
  die: { label: "Die ADS", cls: "text-red-600" },
} as const;

/** Giá số ≤ mốc xanh: xanh; > mốc đỏ: đỏ; ở giữa: cam. Chưa đặt ngưỡng: không tô. */
function costClass(cost: number | null, t: CostThresholds | null) {
  if (cost === null || !t) return "";
  if (cost <= t.green_max) return "text-emerald-600 font-medium";
  if (cost > t.red_min) return "text-red-600 font-medium";
  return "text-amber-600 font-medium";
}

function summarize(rows: AdItem[], count: number) {
  const spend = rows.reduce((s, r) => s + (r.synced ? r.total_spend : 0), 0);
  return { spend, count, cost: count > 0 ? spend / count : null };
}

/**
 * Bảng Hiệu quả Marketing: nhóm theo nhân viên phụ trách, mỗi nhân viên có dòng Tổng,
 * cuối bảng dòng Toàn công ty. Data không tách theo TKQC nên Số data / Giá số chỉ ở
 * dòng Tổng: Giá số = tổng chi ÷ số data (data up có Nguồn MKT gắn với các TKQC).
 */
function EfficiencyTable({ data }: { data: Overview }) {
  const { items, cost_thresholds: thresholds } = data;
  const byOwner = new Map<string, AdItem[]>();
  for (const i of items) byOwner.set(i.owner.id, [...(byOwner.get(i.owner.id) ?? []), i]);
  const groups = [...byOwner.values()];
  const company = summarize(items, data.data_total);
  const td = "border border-slate-200 px-3 py-2";

  const totalCells = (s: ReturnType<typeof summarize>) => (
    <>
      <td className={`${td} text-right`}>{s.count.toLocaleString("vi-VN")}</td>
      <td className={`${td} text-right`}>{vnd(s.spend)}</td>
      <td className={`${td} text-right ${costClass(s.cost, thresholds)}`}>{s.cost === null ? "—" : vnd(s.cost)}</td>
      <td className={td} />
      <td className={td} />
    </>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-slate-700">Hiệu quả Marketing</h2>
        {thresholds ? (
          <p className="text-xs text-slate-500">
            Giá số: <span className="text-emerald-600">xanh ≤ {vnd(thresholds.green_max)}</span> ·{" "}
            <span className="text-amber-600">cam đến {vnd(thresholds.red_min)}</span> ·{" "}
            <span className="text-red-600">đỏ &gt; {vnd(thresholds.red_min)}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-400">Chưa đặt ngưỡng giá số</p>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-700 text-xs font-semibold text-white">
            <tr>
              <th className={td}>Nhân viên</th>
              <th className={td}>TKQC</th>
              <th className={td}>Loại TK</th>
              <th className={`${td} text-right`}>Số data</th>
              <th className={`${td} text-right`}>Tổng chi tiêu</th>
              <th className={`${td} text-right`}>Giá số</th>
              <th className={td}>Trạng thái camp</th>
              <th className={td}>Trạng thái tài khoản</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((rows) => (
              <Fragment key={rows[0].owner.id}>
                {rows.map((i, idx) => {
                  const off = i.status === "disconnected";
                  return (
                    <tr key={i.id}>
                      {idx === 0 && (
                        <td rowSpan={rows.length + 1} className={`${td} text-center align-middle font-medium`}>
                          {i.owner.full_name}
                        </td>
                      )}
                      <td className={td}>{i.name}</td>
                      <td className={td}>{PLATFORM_LABEL[i.platform]}</td>
                      <td className={`${td} text-right`}>
                        {!i.mkt_source && <span className="text-xs text-amber-600">Chưa gắn nguồn MKT</span>}
                      </td>
                      <td className={`${td} text-right`}>{i.synced ? vnd(i.total_spend) : "—"}</td>
                      <td className={td} />
                      <td className={td}>
                        {off || i.has_active_campaign === null ? (
                          "—"
                        ) : i.has_active_campaign ? (
                          <span className="text-emerald-600">Đang hoạt động</span>
                        ) : (
                          <span className="text-slate-500">Dừng hoạt động</span>
                        )}
                      </td>
                      <td className={td}>
                        {off || !i.account_health ? (
                          "—"
                        ) : (
                          <span className={`font-medium ${HEALTH[i.account_health].cls}`}>{HEALTH[i.account_health].label}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-amber-50/70 font-medium">
                  <td className={`${td} text-center`} colSpan={2}>
                    Tổng
                  </td>
                  {totalCells(summarize(rows, data.data_by_owner[rows[0].owner.id] ?? 0))}
                </tr>
              </Fragment>
            ))}
            {items.length > 0 && (
              <tr className="bg-slate-100 font-semibold">
                <td className={`${td} text-center`} colSpan={3}>
                  Toàn công ty
                </td>
                {totalCells(company)}
              </tr>
            )}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  Chưa có tài khoản quảng cáo nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Ngưỡng tô màu giá số — chỉ Admin. */
function ThresholdsModal({
  initial,
  onClose,
  onDone,
}: {
  initial: CostThresholds | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [green, setGreen] = useState(initial ? String(initial.green_max) : "");
  const [red, setRed] = useState(initial ? String(initial.red_min) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const g = Number(green);
  const r = Number(red);
  const valid = green !== "" && red !== "" && Number.isInteger(g) && Number.isInteger(r) && g >= 0 && g < r;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await clientApi("/marketing-hub/cost-thresholds", {
        method: "PUT",
        body: JSON.stringify({ green_max: g, red_min: r }),
      });
      toast.success("Đã lưu ngưỡng giá số");
      await onDone();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Ngưỡng giá số"
      description="Giá số ≤ mốc xanh tô xanh; trên mốc đỏ tô đỏ; ở giữa tô cam. Đơn vị: VNĐ/data."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={busy || !valid} onClick={() => void save()}>
            {busy ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Mốc xanh (giá số thấp, ≤)">
          <Input type="number" min={0} step={1000} value={green} onChange={(e) => setGreen(e.target.value)} />
        </Field>
        <Field label="Mốc đỏ (vượt ngưỡng, >)">
          <Input type="number" min={0} step={1000} value={red} onChange={(e) => setRed(e.target.value)} />
        </Field>
        {green !== "" && red !== "" && !valid && (
          <p className="text-sm text-amber-600">Mốc xanh phải nhỏ hơn mốc đỏ (số nguyên ≥ 0)</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

interface MktSourceRow {
  id?: string;
  name: string;
}

/** Danh mục Nguồn MKT — chỉ Admin. Sửa trực tiếp, thêm dòng, xoá dòng rồi bấm Lưu. */
function MktSourcesModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<MktSourceRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientApi<MktSourceRow[]>("/marketing-hub/mkt-sources")
      .then((r) => setRows(r.length > 0 ? r : [{ name: "" }]))
      .catch((e) => setError(errorText(e)));
  }, []);

  const update = (index: number, name: string) =>
    setRows((prev) => prev?.map((r, i) => (i === index ? { ...r, name } : r)) ?? prev);

  async function save() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi("/marketing-hub/mkt-sources", {
        method: "PUT",
        body: JSON.stringify({ items: rows.filter((r) => r.name.trim()) }),
      });
      toast.success("Đã lưu nguồn MKT");
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Thêm/sửa nguồn MKT"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={busy || !rows} onClick={() => void save()}>
            {busy ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
        {rows === null && !error && <p className="text-sm text-slate-500">Đang tải...</p>}
        {rows?.map((row, index) => (
          <div key={row.id ?? `new-${index}`} className="flex gap-2">
            <Input
              value={row.name}
              maxLength={100}
              placeholder="Tên nguồn MKT"
              onChange={(e) => update(index, e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows((prev) => prev?.filter((_, i) => i !== index) ?? prev)}
            >
              Xoá
            </Button>
          </div>
        ))}
        {rows && (
          <Button type="button" variant="outline" onClick={() => setRows([...rows, { name: "" }])}>
            + Thêm nguồn
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ConnectModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectResult | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await clientApi<ConnectResult>("/marketing-hub/ad-accounts/connect", {
        method: "POST",
        body: JSON.stringify({ platform: "facebook", access_token: token.trim() }),
      });
      setToken(""); // không giữ token trên giao diện sau khi gửi
      setResult(res);
      await onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Liên kết tài khoản Facebook Ads"
      description="Dán access token Facebook có quyền ads_read. Token được mã hoá trên máy chủ và không hiển thị lại."
      maxWidth="max-w-lg"
      footer={
        result ? (
          <Button type="button" onClick={onClose}>
            Đóng
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="button" disabled={busy || token.trim().length < 20} onClick={() => void submit()}>
              {busy ? "Đang kết nối…" : "Liên kết"}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-2 text-sm">
          <p>
            Đã liên kết <b>{result.connected}</b> tài khoản quảng cáo.
          </p>
          {result.skipped.length > 0 && (
            <ul className="list-disc pl-5 text-amber-700">
              {result.skipped.map((s) => (
                <li key={s.name}>
                  {s.name}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Field label="Access token">
            <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

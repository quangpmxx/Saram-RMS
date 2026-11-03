"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api-client";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

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
}
interface Overview {
  from: string;
  to: string;
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
const daysAgo = (n: number) => new Date(Date.now() + 7 * 3600_000 - n * 86_400_000).toISOString().slice(0, 10);

/**
 * Marketing Hub — bảng tổng quan tài khoản quảng cáo. Chỉ hiển thị chi tiêu thật đã
 * đồng bộ từ Facebook (tài khoản chưa đồng bộ hiện "—"); không có chi phí/data theo nhân viên.
 */
export function MarketingHubClient({ role, userId }: { role: string; userId: string }) {
  useSetPageTitle("Marketing Hub", "Tài khoản quảng cáo và chi tiêu");
  const toast = useToast();
  const isAdmin = role === "admin";
  const canConnect = isAdmin || role === "mkt";

  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [platform, setPlatform] = useState("");
  const [accountId, setAccountId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [allItems, setAllItems] = useState<AdItem[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [showMktSources, setShowMktSources] = useState(false);

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
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Từ ngày">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Nền tảng">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
          </Select>
        </Field>
        <Field label="Tài khoản">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Tất cả</option>
            {allItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nhân viên">
          <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Tất cả</option>
            {owners.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        {isAdmin && (
          <Button type="button" variant="outline" className="ml-auto" onClick={() => setShowMktSources(true)}>
            Thêm/sửa nguồn MKT
          </Button>
        )}
        {canConnect && (
          <Button type="button" className={isAdmin ? "" : "ml-auto"} onClick={() => setShowConnect(true)}>
            Liên kết tài khoản Facebook
          </Button>
        )}
      </div>

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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Nhân viên phụ trách</th>
              <th className="px-3 py-2">Tài khoản quảng cáo</th>
              <th className="px-3 py-2">Loại</th>
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
                          size="sm"
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
                          size="sm"
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
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  Chưa có tài khoản quảng cáo nào được liên kết
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onDone={load} />}
      {showMktSources && <MktSourcesModal onClose={() => setShowMktSources(false)} />}
    </div>
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

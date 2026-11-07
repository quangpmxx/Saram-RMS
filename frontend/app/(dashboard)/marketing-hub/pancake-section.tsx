"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

interface PancakePageItem {
  id: string;
  page_id: string;
  name: string;
  owner: { id: string; full_name: string };
  mkt_source: { id: string; name: string } | null;
  status: "connected" | "error" | "disconnected";
  synced: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  message_count: number;
  phone_count: number;
  phone_rate: number | null;
  lead_count: number;
}
type Option = { id: string; name: string };

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : "Có lỗi xảy ra";
const num = (n: number) => n.toLocaleString("vi-VN");

/**
 * Bảng Pancake theo page (theo kỳ đang lọc): người nhắn mới, số để lại SĐT, tỉ lệ, data đã up
 * tự động. Liên kết/gỡ: Admin hoặc MKT (page của mình); đổi phụ trách / Nguồn MKT: Admin.
 */
export function PancakeSection({
  from,
  to,
  isAdmin,
  canConfig,
  canConnect,
  userId,
  staff,
  mktSources,
}: {
  from: string;
  to: string;
  isAdmin: boolean;
  /** Gắn Nguồn MKT (quyền mkt.config). */
  canConfig: boolean;
  canConnect: boolean;
  userId: string;
  staff: { id: string; full_name: string }[];
  mktSources: Option[];
}) {
  const toast = useToast();
  const [items, setItems] = useState<PancakePageItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await clientApi<{ items: PancakePageItem[] }>(
        `/pancake/pages?${new URLSearchParams({ from, to })}`,
      );
      setItems(r.items);
    } catch (e) {
      toast.error(errorText(e));
    }
  }, [from, to, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

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

  const patch = (id: string, path: string, body: object, okMsg: string) =>
    void act(
      id,
      () =>
        clientApi(`/pancake/pages/${id}/${path}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      okMsg,
    );

  const shown = items?.filter((i) => i.status !== "disconnected") ?? [];
  const total = shown.reduce(
    (s, i) => ({
      m: s.m + i.message_count,
      p: s.p + i.phone_count,
      l: s.l + i.lead_count,
    }),
    { m: 0, p: 0, l: 0 },
  );
  const td = "border border-slate-200 px-3 py-2";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Pancake theo page
        </h2>
        {canConnect && (
          <Button type="button" size="xs" onClick={() => setShowConnect(true)}>
            Liên kết Pancake
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
        <table className="w-full border-collapse text-sm [&_td]:text-center [&_th]:text-center">
          <thead className="bg-slate-700 text-xs font-semibold text-white">
            <tr>
              <th className={td}>Page</th>
              <th className={td}>Nhân viên phụ trách</th>
              <th className={td}>Nguồn MKT</th>
              <th className={td}>Người nhắn tin mới</th>
              <th className={td}>Để lại SĐT</th>
              <th className={td}>Tỉ lệ để lại SĐT</th>
              <th className={td}>Data đã up tự động</th>
              <th className={td}>Trạng thái</th>
              <th className={td} />
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => {
              const mine = isAdmin || i.owner.id === userId;
              const ownerOptions = [
                ...new Map<string, string>([
                  [i.owner.id, i.owner.full_name],
                  ...staff.map((s) => [s.id, s.full_name] as [string, string]),
                ]),
              ];
              return (
                <tr key={i.id}>
                  <td className={td}>{i.name}</td>
                  <td className={td}>
                    {isAdmin ? (
                      <Select
                        value={i.owner.id}
                        disabled={busyId === i.id}
                        onChange={(e) =>
                          patch(
                            i.id,
                            "owner",
                            { owner_id: e.target.value },
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
                  <td className={td}>
                    {canConfig ? (
                      <Select
                        value={i.mkt_source?.id ?? ""}
                        disabled={busyId === i.id}
                        onChange={(e) =>
                          patch(
                            i.id,
                            "mkt-source",
                            { mkt_source_id: e.target.value || null },
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
                      (i.mkt_source?.name ?? (
                        <span className="text-xs text-amber-600">
                          Chưa gắn
                        </span>
                      ))
                    )}
                  </td>
                  <td className={td}>{i.synced ? num(i.message_count) : "—"}</td>
                  <td className={td}>{i.synced ? num(i.phone_count) : "—"}</td>
                  <td className={`${td} font-medium`}>
                    {i.phone_rate === null
                      ? "—"
                      : `${(i.phone_rate * 100).toFixed(1).replace(".", ",")}%`}
                  </td>
                  <td className={td}>{num(i.lead_count)}</td>
                  <td className={td}>
                    <span
                      className={
                        i.status === "connected"
                          ? "text-emerald-600"
                          : "text-red-600"
                      }
                    >
                      {i.status === "connected" ? "Đã kết nối" : "Lỗi kết nối"}
                    </span>
                    <div className="text-xs text-slate-400">
                      {i.synced
                        ? `Đọc lúc: ${new Date(i.last_sync_at!).toLocaleTimeString("vi-VN")}`
                        : "Đang lấy dữ liệu…"}
                    </div>
                    {i.last_error && (
                      <div className="text-xs text-red-500">{i.last_error}</div>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {mine && canConnect && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={busyId === i.id}
                        onClick={() => {
                          if (
                            confirm(
                              `Gỡ liên kết page "${i.name}"? Token sẽ bị xoá, ngừng up tự động từ page này.`,
                            )
                          )
                            void act(
                              i.id,
                              () =>
                                clientApi(`/pancake/pages/${i.id}`, {
                                  method: "DELETE",
                                }),
                              "Đã gỡ liên kết",
                            );
                        }}
                      >
                        Gỡ
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {shown.length > 0 && (
              <tr className="bg-slate-100 font-semibold">
                <td className={td} colSpan={3}>
                  Tổng
                </td>
                <td className={td}>{num(total.m)}</td>
                <td className={td}>{num(total.p)}</td>
                <td className={td}>
                  {total.m > 0
                    ? `${((total.p / total.m) * 100).toFixed(1).replace(".", ",")}%`
                    : "—"}
                </td>
                <td className={td}>{num(total.l)}</td>
                <td className={td} colSpan={2} />
              </tr>
            )}
            {items && shown.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  Chưa có page Pancake nào được liên kết
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {showConnect && (
        <ConnectPancakeModal
          onClose={() => setShowConnect(false)}
          onDone={load}
        />
      )}
    </div>
  );
}

function ConnectPancakeModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await clientApi("/pancake/pages/connect", {
        method: "POST",
        body: JSON.stringify({ access_token: token.trim(), name: name.trim() }),
      });
      setToken(""); // không giữ token trên giao diện sau khi gửi
      toast.success("Đã liên kết page, đang lấy dữ liệu 30 ngày gần nhất");
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
      title="Liên kết page Pancake"
      description="Lấy token trong Pancake: Cài đặt page → Công cụ → API. Mỗi page một token."
      maxWidth="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="button"
            disabled={busy || token.trim().length < 20 || !name.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Đang kết nối…" : "Liên kết"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Field label="Tên page">
          <Input
            value={name}
            maxLength={255}
            placeholder="Vd: Page tuyển dụng A"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Token page Pancake">
          <Input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

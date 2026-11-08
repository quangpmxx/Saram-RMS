"use client";

import { useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

interface AutoUpTeam {
  team_id: string;
  name: string;
  weight: number;
}
interface AutoUpConfig {
  is_active: boolean;
  activated_at: string | null;
  teams: AutoUpTeam[];
}

/**
 * Up tự động từ Pancake (Admin/MKT): bật/tắt + tỉ lệ chia nhóm đan xen, dùng chung mọi page.
 * Tỉ lệ 0 = nhóm không nhận số; nhóm mới tạo tự hiện ở đây với tỉ lệ 0.
 */
export function PancakeAutoUpModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (config: AutoUpConfig) => void;
}) {
  const [config, setConfig] = useState<AutoUpConfig | null>(null);
  /** Chọn 1 nhóm (như form thêm lao động): mọi số vào nhóm này, khoá ô tỉ lệ. */
  const [singleTeamId, setSingleTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyLoaded(c: AutoUpConfig) {
    setConfig(c);
    const on = c.teams.filter((t) => t.weight > 0);
    setSingleTeamId(on.length === 1 ? on[0].team_id : null);
  }

  useEffect(() => {
    clientApi<AutoUpConfig>("/pancake/auto-up")
      .then(applyLoaded)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "Có lỗi xảy ra"),
      );
  }, []);

  const weightOf = (t: AutoUpTeam) =>
    singleTeamId ? (t.team_id === singleTeamId ? 1 : 0) : t.weight;
  const receiving = config?.teams.filter((t) => weightOf(t) > 0) ?? [];
  const ratioText = singleTeamId
    ? ""
    : receiving.map((t) => t.weight).join("-");
  const teamButtons = [...(config?.teams ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, "vi", { numeric: true }),
  );

  function setWeight(teamId: string, value: string) {
    const n = Math.max(0, Math.min(20, Math.floor(Number(value) || 0)));
    setConfig((c) =>
      c
        ? {
            ...c,
            teams: c.teams.map((t) =>
              t.team_id === teamId ? { ...t, weight: n } : t,
            ),
          }
        : c,
    );
  }

  function move(index: number, dir: -1 | 1) {
    setConfig((c) => {
      if (!c) return c;
      const next = [...c.teams];
      const j = index + dir;
      if (j < 0 || j >= next.length) return c;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...c, teams: next };
    });
  }

  async function save(isActive: boolean) {
    if (!config) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await clientApi<AutoUpConfig>("/pancake/auto-up", {
        method: "PUT",
        body: JSON.stringify({
          is_active: isActive,
          teams: config.teams.map((t) => ({
            team_id: t.team_id,
            weight: weightOf(t),
          })),
        }),
      });
      applyLoaded(saved);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Up tự động từ Pancake"
      maxWidth="max-w-sm"
      footer={
        // 3 nút luôn nằm 1 hàng ngang (kể cả trên điện thoại): cỡ nhỏ, chia đều chiều rộng.
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 whitespace-nowrap"
            onClick={onClose}
          >
            Đóng
          </Button>
          {config?.is_active ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 whitespace-nowrap"
                disabled={busy}
                onClick={() => void save(false)}
              >
                Tắt Up tự động
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1 whitespace-nowrap"
                disabled={busy || receiving.length === 0}
                onClick={() => void save(true)}
              >
                Lưu tỉ lệ
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 whitespace-nowrap"
                disabled={busy || !config}
                onClick={() => void save(false)}
              >
                Lưu (chưa bật)
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1 whitespace-nowrap"
                disabled={busy || receiving.length === 0}
                onClick={() => void save(true)}
              >
                Bật Up tự động
              </Button>
            </>
          )}
        </div>
      }
    >
      {!config && !error && (
        <p className="text-sm text-slate-500">Đang tải...</p>
      )}
      {config && (
        <div className="space-y-3 text-sm">
          <p>
            Trạng thái:{" "}
            {config.is_active ? (
              <b className="text-emerald-600">Đang bật</b>
            ) : (
              <b className="text-slate-500">Đang tắt</b>
            )}
            {config.is_active && config.activated_at && (
              <span className="text-xs text-slate-500">
                {" "}
                (từ {new Date(config.activated_at).toLocaleString("vi-VN")})
              </span>
            )}
          </p>
          {teamButtons.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-slate-700">
                Vào 1 nhóm
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {teamButtons.map((t, index) => {
                  const selected = singleTeamId === t.team_id;
                  return (
                    <button
                      key={t.team_id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setSingleTeamId(selected ? null : t.team_id)
                      }
                      className={`${
                        index % 2 === 0 ? "bg-emerald-600" : "bg-orange-500"
                      } rounded-md px-2 py-1.5 text-xs font-semibold text-white transition ${
                        selected
                          ? "opacity-100 ring-2 ring-slate-400 ring-offset-1"
                          : "opacity-50 hover:opacity-80"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className={singleTeamId ? "opacity-50" : undefined}>
            <p className="mb-1 font-medium text-slate-700">
              Hoặc chia theo tỉ lệ{" "}
              {ratioText && (
                <span className="text-brand-700">({ratioText})</span>
              )}
            </p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {config.teams.map((t, i) => (
                <div key={t.team_id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="flex-1">{t.name}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={!!singleTeamId || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Lên"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={!!singleTeamId || i === config.teams.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Xuống"
                  >
                    ↓
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    className="w-16 text-center"
                    disabled={!!singleTeamId}
                    value={t.weight}
                    onChange={(e) => setWeight(t.team_id, e.target.value)}
                  />
                </div>
              ))}
              {config.teams.length === 0 && (
                <p className="px-3 py-4 text-center text-slate-400">
                  Chưa có nhóm nào
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

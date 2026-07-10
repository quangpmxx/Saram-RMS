"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { DistributionRule, TeamMember } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/form";

/**
 * Mục 3, docs/09 + Mục 5, docs/12-ui-design.md — popup "cấu hình vòng quay
 * tự động phân chia": Leader chọn + sắp xếp thứ tự Sale tham gia, kích
 * hoạt/tạm dừng. Chỉ hiện với Leader (nhóm mình) — đúng phạm vi quyền
 * PUT/activate/pause đã chốt tại Mục 5, docs/13 (Quản lý/Admin chỉ xem).
 */
export function DistributionRuleModal({
  teamId,
  teamMembers,
  onClose,
  onChanged,
}: {
  teamId: string;
  teamMembers: TeamMember[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rule, setRule] = useState<DistributionRule | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [addAccountId, setAddAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clientApi<DistributionRule>(`/distribution-rule/${teamId}`)
      .then((result) => {
        if (cancelled) return;
        setRule(result);
        setOrderedIds(result.members.map((member) => member.account_id));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const memberById = new Map(teamMembers.map((member) => [member.id, member]));
  const availableToAdd = teamMembers.filter((member) => !orderedIds.includes(member.id));

  function moveUp(index: number) {
    if (index === 0) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setOrderedIds((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function removeAt(index: number) {
    setOrderedIds((prev) => prev.filter((_, i) => i !== index));
  }

  function addSelected() {
    if (!addAccountId) return;
    setOrderedIds((prev) => [...prev, addAccountId]);
    setAddAccountId("");
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await clientApi<DistributionRule>(`/distribution-rule/${teamId}`, {
        method: "PUT",
        body: JSON.stringify({ account_ids: orderedIds }),
      });
      setRule(updated);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive() {
    setIsTogglingActive(true);
    setError(null);
    try {
      const path = rule?.is_active ? "pause" : "activate";
      const updated = await clientApi<DistributionRule>(`/distribution-rule/${teamId}/${path}`, {
        method: "POST",
      });
      setRule(updated);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsTogglingActive(false);
    }
  }

  return (
    <Modal
      title="Cấu hình tự động phân chia (Round-robin)"
      description="Sắp xếp thứ tự Sale tham gia vòng quay — lead mới sẽ tự động gán lần lượt theo thứ tự này khi đang bật. Có thể tạm dừng bất kỳ lúc nào để quay lại phân chia thủ công."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button type="button" disabled={isSaving || isLoading} onClick={() => void handleSave()}>
            {isSaving ? "Đang lưu..." : "Lưu danh sách"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-slate-700">
              Trạng thái:
              {rule?.is_active ? (
                <Badge variant="success">Đang bật</Badge>
              ) : (
                <Badge variant="neutral">Đang tắt</Badge>
              )}
            </span>
            <Button
              type="button"
              size="sm"
              variant={rule?.is_active ? "outline" : "secondary"}
              disabled={isTogglingActive || (!rule?.is_active && orderedIds.length === 0)}
              onClick={() => void handleToggleActive()}
            >
              {isTogglingActive ? "Đang lưu..." : rule?.is_active ? "Tạm dừng" : "Kích hoạt"}
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            {orderedIds.length === 0 && (
              <p className="text-sm text-slate-400">Chưa có Sale nào tham gia vòng quay.</p>
            )}
            {orderedIds.map((accountId, index) => {
              const member = memberById.get(accountId);
              return (
                <div
                  key={accountId}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="w-5 text-center text-xs font-semibold text-slate-400">{index + 1}</span>
                  <span className="flex-1 text-sm text-slate-800">{member?.full_name ?? accountId}</span>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveUp(index)}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    title="Đưa lên trước"
                  >
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    disabled={index === orderedIds.length - 1}
                    onClick={() => moveDown(index)}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    title="Đưa xuống sau"
                  >
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Bỏ khỏi vòng quay"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>

          {availableToAdd.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={addAccountId} onChange={(event) => setAddAccountId(event.target.value)}>
                <option value="">— Thêm Sale vào vòng quay —</option>
                {availableToAdd.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={addSelected} disabled={!addAccountId}>
                Thêm
              </Button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

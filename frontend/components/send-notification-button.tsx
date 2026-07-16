"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { ACCOUNT_ROLE_LABEL, type Account, type PaginatedResult, type Team } from "@/lib/types";
import { roleAccentTextStyle } from "@/lib/role-accent";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea, Checkbox } from "@/components/ui/form";

/**
 * Dự án phụ — nâng cấp toàn diện: chỉ Admin thấy — soạn + gửi thông báo
 * trong ứng dụng (chuông/toast, xem NotificationBell) cho 1 nhóm hoặc
 * nhiều thành viên cụ thể. Gọi POST /notification (mới, chỉ Admin).
 */
export function SendNotificationButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" title="Gửi thông báo" onClick={() => setIsOpen(true)}>
        <Send className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="hidden sm:inline">Gửi thông báo</span>
      </Button>
      {isOpen && <SendNotificationModal onClose={() => setIsOpen(false)} />}
    </>
  );
}

function SendNotificationModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState("");
  const [targetType, setTargetType] = useState<"team" | "account">("team");
  const [teams, setTeams] = useState<Team[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      clientApi<PaginatedResult<Team>>("/team?page=1&page_size=200"),
      clientApi<PaginatedResult<Account>>("/account?page=1&page_size=200&status=active"),
    ])
      .then(([teamResult, accountResult]) => {
        if (cancelled) return;
        setTeams(teamResult.items);
        setAccounts(accountResult.items);
      })
      .catch(() => {
        if (!cancelled) setError("Không tải được danh sách nhóm/tài khoản");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Yêu cầu trực tiếp người dùng (2026-07-16): thêm lựa chọn "Tất cả" trong
  // danh sách Đối tượng gửi — thuần UX ở frontend (tick 1 phát chọn/bỏ chọn
  // hết toàn bộ nhóm/thành viên đang hiển thị theo đúng tab đang chọn),
  // KHÔNG cần đổi API — vẫn gửi nguyên mảng target_ids như chọn tay từng ô.
  const currentOptionIds = (targetType === "team" ? teams : accounts).map((item) => item.id);
  const isAllSelected = currentOptionIds.length > 0 && currentOptionIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    setSelectedIds(isAllSelected ? new Set() : new Set(currentOptionIds));
  }

  function handleChangeTargetType(next: "team" | "account") {
    setTargetType(next);
    setSelectedIds(new Set());
  }

  async function handleSubmit() {
    setError(null);
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Vui lòng nhập nội dung thông báo");
      return;
    }
    if (selectedIds.size === 0) {
      setError(targetType === "team" ? "Vui lòng chọn ít nhất 1 nhóm" : "Vui lòng chọn ít nhất 1 thành viên");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await clientApi<{ recipient_count: number }>("/notification", {
        method: "POST",
        body: JSON.stringify({
          content: trimmed,
          target_type: targetType,
          target_ids: [...selectedIds],
        }),
      });
      setRecipientCount(result.recipient_count);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (recipientCount !== null) {
    return (
      <Modal title="Gửi thông báo" footer={<Button type="button" onClick={onClose}>Đóng</Button>}>
        <p className="text-sm text-emerald-700">Đã gửi thông báo tới {recipientCount} tài khoản.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Gửi thông báo"
      description="Người nhận sẽ thấy ngay ở chuông thông báo + toast nổi."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang gửi..." : "Gửi"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Nội dung thông báo">
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={3} autoFocus />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Đối tượng gửi</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={targetType === "team" ? "secondary" : "outline"}
              onClick={() => handleChangeTargetType("team")}
            >
              Theo nhóm
            </Button>
            <Button
              type="button"
              size="sm"
              variant={targetType === "account" ? "secondary" : "outline"}
              onClick={() => handleChangeTargetType("account")}
            >
              Theo thành viên
            </Button>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
          {isLoadingOptions ? (
            <p className="p-2 text-xs text-slate-400">Đang tải...</p>
          ) : currentOptionIds.length === 0 ? (
            <p className="p-2 text-xs text-slate-400">{targetType === "team" ? "Chưa có nhóm nào" : "Chưa có tài khoản nào"}</p>
          ) : (
            <>
              <label className="mb-1 flex items-center gap-2 rounded border-b border-slate-100 px-2 py-1.5 text-sm font-medium hover:bg-slate-50">
                <Checkbox checked={isAllSelected} onChange={toggleAll} />
                Tất cả
                <span className="text-xs font-normal text-slate-400">({currentOptionIds.length})</span>
              </label>
              {targetType === "team"
                ? teams.map((team) => (
                    <label key={team.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                      <Checkbox checked={selectedIds.has(team.id)} onChange={() => toggleId(team.id)} />
                      {team.name}
                      <span className="text-xs text-slate-400">({team.member_count} thành viên)</span>
                    </label>
                  ))
                : accounts.map((account) => (
                    <label key={account.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                      <Checkbox checked={selectedIds.has(account.id)} onChange={() => toggleId(account.id)} />
                      {account.full_name}
                      <span className="text-xs text-slate-400">
                        (<span style={roleAccentTextStyle(account.role)}>{ACCOUNT_ROLE_LABEL[account.role]}</span>
                        {account.team_name ? ` · ${account.team_name}` : ""})
                      </span>
                    </label>
                  ))}
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { ModulePermissionLevel, OrderRecord } from "@/lib/types";
import { shuttleColorStyle } from "@/lib/shuttle-colors";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ColorPalette } from "@/components/ui/color-palette";
import { ViewOnlyBadge } from "@/components/ui/view-only-badge";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-26, yêu cầu trực tiếp người dùng):
 * "Cái thêm đơn hàng mới này để tạm 1 nút... ấn vào thêm đơn hàng mới hiện
 * ra danh sách và chỉnh sửa, còn không gian của trang quản lý đơn hàng này
 * sau sẽ thiết kế nghiệp vụ khác" — CHỈ 1 nút "Thêm đơn hàng mới" góc phải,
 * toàn bộ danh sách + thêm/sửa/xóa nằm trong popup (KHÔNG chiếm không gian
 * chính của trang, để dành cho nghiệp vụ khác thiết kế sau). Màu nền/màu
 * chữ tái dùng nguyên vẹn ColorPalette + bảng màu SHUTTLE_OPTION_COLORS của
 * trang Đưa đón. Chỉ có tên đơn hàng, không tự thêm trường nào khác (đã hỏi
 * lại người dùng và xác nhận "chỉ tên đơn hàng, đơn giản nhất").
 */
export function OrderManagementClient({
  permissionLevel,
  initialRecords,
}: {
  permissionLevel: ModulePermissionLevel;
  initialRecords: OrderRecord[];
}) {
  useSetPageTitle("Quản lý đơn hàng", "Chỉ Admin xem/sửa được.");
  const isReadOnly = permissionLevel === "view";
  const router = useRouter();
  const toast = useToast();

  const [records, setRecords] = useState(initialRecords);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newColorKey, setNewColorKey] = useState<string | null>(null);
  const [newTextColorKey, setNewTextColorKey] = useState<string | null>(null);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColorKey, setEditColorKey] = useState<string | null>(null);
  const [editTextColorKey, setEditTextColorKey] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function refresh() {
    const result = await clientApi<OrderRecord[]>("/order-management");
    setRecords(result);
    router.refresh();
  }

  async function handleAddConfirm() {
    const trimmed = newName.trim();
    if (!trimmed || isSubmittingNew) return;
    setIsSubmittingNew(true);
    try {
      await clientApi("/order-management", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, color_key: newColorKey, text_color_key: newTextColorKey }),
      });
      setNewName("");
      setNewColorKey(null);
      setNewTextColorKey(null);
      await refresh();
      toast.success("Đã thêm đơn hàng");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, không thể thêm đơn hàng");
    } finally {
      setIsSubmittingNew(false);
    }
  }

  function startEdit(record: OrderRecord) {
    setEditingId(record.id);
    setEditName(record.name);
    setEditColorKey(record.color_key);
    setEditTextColorKey(record.text_color_key);
  }

  async function handleSaveEdit() {
    if (!editingId || !editName.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await clientApi(`/order-management/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), color_key: editColorKey, text_color_key: editTextColorKey }),
      });
      setEditingId(null);
      await refresh();
      toast.success("Đã lưu thay đổi");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, không thể lưu");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    setPendingDeleteId(id);
    try {
      await clientApi(`/order-management/${id}`, { method: "DELETE" });
      if (editingId === id) setEditingId(null);
      await refresh();
      toast.success("Đã xóa đơn hàng");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Có lỗi xảy ra, không thể xóa");
    } finally {
      setPendingDeleteId(null);
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
  }

  return (
    <div className="mx-auto max-w-5xl">
      {isReadOnly && (
        <div className="mb-3">
          <ViewOnlyBadge />
        </div>
      )}
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={isReadOnly} onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Thêm đơn hàng mới
        </Button>
      </div>

      <div className="mt-10">
        <EmptyState
          icon={<ListChecks className="h-5 w-5" strokeWidth={1.75} />}
          title="Nghiệp vụ quản lý đơn hàng sẽ sớm được ra mắt"
          description="Bấm “Thêm đơn hàng mới” ở trên để quản lý danh sách tên đơn hàng."
        />
      </div>

      {isModalOpen && (
        <Modal title="Danh sách đơn hàng" maxWidth="max-w-lg" footer={<Button type="button" variant="outline" onClick={closeModal}>Đóng</Button>}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {records.length === 0 && <p className="text-sm text-slate-400">Chưa có đơn hàng nào.</p>}
              {records.map((record) => {
                const isEditing = editingId === record.id;
                const style = shuttleColorStyle(record.color_key, record.text_color_key);
                return (
                  <div key={record.id} className="rounded-lg border border-slate-200 p-2.5">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <Input uiSize="sm" value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus />
                        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu nền</p>
                        <ColorPalette selected={editColorKey} onPick={setEditColorKey} />
                        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu chữ</p>
                        <ColorPalette selected={editTextColorKey} onPick={setEditTextColorKey} />
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="xs" onClick={() => setEditingId(null)}>
                            Hủy
                          </Button>
                          <Button type="button" size="xs" disabled={isSavingEdit} onClick={() => void handleSaveEdit()}>
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                            {isSavingEdit ? "Đang lưu..." : "Lưu"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span
                          style={style}
                          className={cn(
                            "min-w-0 flex-1 rounded-full px-2.5 py-1 text-xs font-medium break-words whitespace-normal",
                            !style && "bg-slate-100 text-slate-700",
                          )}
                        >
                          {record.name}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          <Button type="button" variant="ghost" size="xs" onClick={() => startEdit(record)}>
                            <Pencil className="h-3 w-3" strokeWidth={2} />
                            Sửa
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={pendingDeleteId === record.id}
                            onClick={() => void handleDelete(record.id)}
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={2} />
                            Xóa
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Thêm đơn hàng mới</p>
              <div className="flex flex-col gap-2">
                <Input
                  uiSize="sm"
                  placeholder="Tên đơn hàng mới..."
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleAddConfirm()}
                  autoFocus
                />
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu nền</p>
                <ColorPalette selected={newColorKey} onPick={setNewColorKey} />
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Màu chữ</p>
                <ColorPalette selected={newTextColorKey} onPick={setNewTextColorKey} />
                <div className="flex justify-end">
                  <Button type="button" size="sm" disabled={isSubmittingNew} onClick={() => void handleAddConfirm()}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {isSubmittingNew ? "Đang lưu..." : "Thêm"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

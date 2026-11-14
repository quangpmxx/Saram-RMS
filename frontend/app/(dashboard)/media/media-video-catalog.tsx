"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { ColorPalette } from "@/components/ui/color-palette";
import { useToast } from "@/lib/toast-context";
import { shuttleColorStyle } from "@/lib/shuttle-colors";
import { cn } from "@/lib/cn";
import { PLATFORMS, PLATFORM_META, type MediaOptions } from "./media-shared";
import type { VideoCatalog } from "./media-videos";

type GroupForm = { id?: string; name: string; color_key: string | null };
type ChannelForm = { id?: string; name: string; platform: string; url: string; owner_id: string; color_key: string | null; active: boolean };

/** Danh mục Sổ video: nhóm nội dung + kênh đăng (người quản lý kế hoạch sửa). */
export function VideoCatalogModal({ options, catalog, onClose, onChanged }: { options: MediaOptions; catalog: VideoCatalog; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<"groups" | "channels">("groups");
  const [group, setGroup] = useState<GroupForm | null>(null);
  const [channel, setChannel] = useState<ChannelForm | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveGroup = () => {
    if (!group?.name.trim()) return toast.error("Nhập tên nhóm");
    void call(
      () => clientApi(group.id ? `/media/content-groups/${group.id}` : "/media/content-groups", { method: group.id ? "PUT" : "POST", body: JSON.stringify({ name: group.name, color_key: group.color_key }) }),
      "Đã lưu nhóm",
    ).then((ok) => ok && setGroup(null));
  };

  const saveChannel = () => {
    if (!channel?.name.trim()) return toast.error("Nhập tên kênh");
    void call(
      () =>
        clientApi(channel.id ? `/media/channels/${channel.id}` : "/media/channels", {
          method: channel.id ? "PUT" : "POST",
          body: JSON.stringify({ ...channel, id: undefined, url: channel.url || null, owner_id: channel.owner_id || null }),
        }),
      "Đã lưu kênh",
    ).then((ok) => ok && setChannel(null));
  };

  return (
    <Modal title="Nhóm nội dung & kênh đăng" maxWidth="max-w-xl" footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}>
      <div className="mb-3 flex rounded-lg bg-slate-100 p-0.5 text-sm font-semibold">
        {(["groups", "channels"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex-1 rounded-md py-1.5", tab === k ? "bg-white text-violet-700 shadow-sm" : "text-slate-500")}>
            {k === "groups" ? `Nhóm nội dung (${catalog.groups.length})` : `Kênh đăng (${catalog.channels.length})`}
          </button>
        ))}
      </div>

      {tab === "groups" ? (
        <div className="space-y-2">
          {catalog.groups.map((g) =>
            group?.id === g.id ? null : (
              <div key={g.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", !g.color_key && "bg-slate-100 text-slate-700")} style={shuttleColorStyle(g.color_key)}>{g.name}</span>
                <button type="button" onClick={() => setGroup({ id: g.id, name: g.name, color_key: g.color_key })} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100"><Pencil className="size-4" /></button>
                <button type="button" onClick={() => confirm(`Xoá nhóm "${g.name}"? Video đã gắn sẽ để trống nhóm.`) && call(() => clientApi(`/media/content-groups/${g.id}`, { method: "DELETE" }), "Đã xoá")} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 className="size-4" /></button>
              </div>
            ),
          )}
          {group ? (
            <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
              <Input uiSize="sm" autoFocus placeholder="Tên nhóm, VD: Giải trí" value={group.name} maxLength={100} onChange={(e) => setGroup({ ...group, name: e.target.value })} />
              <ColorPalette selected={group.color_key} onPick={(k) => setGroup({ ...group, color_key: k })} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setGroup(null)}>Huỷ</Button>
                <Button size="sm" disabled={busy} onClick={saveGroup}>Lưu</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setGroup({ name: "", color_key: null })}><Plus className="mr-1 inline size-4" />Thêm nhóm</Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {catalog.channels.map((c) =>
            channel?.id === c.id ? null : (
              <div key={c.id} className={cn("flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2", !c.active && "opacity-50")}>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", !c.color_key && "bg-pink-50 text-pink-700")} style={shuttleColorStyle(c.color_key)}>{c.name}</span>
                <span className="truncate text-xs text-slate-500">{PLATFORM_META[c.platform]?.label} {c.owner ? `· ${c.owner.name}` : ""}{!c.active ? " · ngừng dùng" : ""}</span>
                <button type="button" onClick={() => setChannel({ id: c.id, name: c.name, platform: c.platform, url: c.url ?? "", owner_id: c.owner?.id ?? "", color_key: c.color_key, active: c.active })} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100"><Pencil className="size-4" /></button>
                <button type="button" onClick={() => confirm(`Xoá kênh "${c.name}"? Bài đã đăng vẫn giữ tên kênh.`) && call(() => clientApi(`/media/channels/${c.id}`, { method: "DELETE" }), "Đã xoá")} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 className="size-4" /></button>
              </div>
            ),
          )}
          {channel ? (
            <div className="space-y-2 rounded-xl border border-pink-200 bg-pink-50/40 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Tên kênh" uiSize="sm"><Input uiSize="sm" autoFocus placeholder="VD: Chi Đại Việt" value={channel.name} maxLength={150} onChange={(e) => setChannel({ ...channel, name: e.target.value })} /></Field>
                <Field label="Nền tảng" uiSize="sm">
                  <Select uiSize="sm" value={channel.platform} onChange={(e) => setChannel({ ...channel, platform: e.target.value })}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
                  </Select>
                </Field>
                <Field label="Người giữ kênh" uiSize="sm">
                  <Select uiSize="sm" value={channel.owner_id} onChange={(e) => setChannel({ ...channel, owner_id: e.target.value })}>
                    <option value="">—</option>
                    {options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </Field>
                <Field label="Link kênh" uiSize="sm"><Input uiSize="sm" placeholder="https://www.tiktok.com/@..." value={channel.url} onChange={(e) => setChannel({ ...channel, url: e.target.value })} /></Field>
              </div>
              <ColorPalette selected={channel.color_key} onPick={(k) => setChannel({ ...channel, color_key: k })} />
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" className="accent-violet-600" checked={channel.active} onChange={(e) => setChannel({ ...channel, active: e.target.checked })} />Đang dùng</label>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setChannel(null)}>Huỷ</Button>
                <Button size="sm" disabled={busy} onClick={saveChannel}>Lưu</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setChannel({ name: "", platform: "tiktok", url: "", owner_id: "", color_key: null, active: true })}><Plus className="mr-1 inline size-4" />Thêm kênh</Button>
          )}
        </div>
      )}
    </Modal>
  );
}

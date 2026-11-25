"use client";

import { useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/lib/toast-context";

/**
 * "Dạy" Trợ lý AI về công ty (2026-11-25, yêu cầu người dùng): tên trợ lý, trợ lý là ai, sổ tay
 * công ty. AI đọc kèm mỗi câu hỏi (không huấn luyện lại) — sửa xong là dùng ngay. Danh bạ nhân sự
 * + nhóm phần mềm tự thêm từ trang Tài khoản, không cần gõ.
 */
interface KnowledgeConfig {
  assistant_name: string;
  persona: string;
  knowledge: string;
}

const PERSONA_SAMPLE = `Tôi là Trợ lý AI riêng của Công ty Đại Việt, được tạo ra bởi anh [Tên] — Trưởng phòng Marketing.
Nhiệm vụ: giúp anh chị trong công ty tra số liệu, tình hình tuyển dụng, đưa đón, marketing nhanh bằng giọng nói.
Xưng "em", gọi người hỏi là "anh/chị". Giọng thân thiện, ngắn gọn.`;

const KNOWLEDGE_SAMPLE = `GIỚI THIỆU CÔNG TY
- Tên: Công ty ... (Đại Việt / Saram Vina), lĩnh vực: tuyển dụng & cung ứng lao động.
- Địa chỉ văn phòng: ...
- Thành lập năm: ...

BAN LÃNH ĐẠO
- Giám đốc: ...
- Trưởng phòng Marketing: ...
- ...

CÁC PHÒNG BAN & CÔNG VIỆC
- Marketing: chạy quảng cáo, lên data...
- Sale: gọi data, hẹn lao động đi phỏng vấn...
- Đưa đón: đón lao động đi phỏng vấn...

ĐƠN HÀNG ĐANG TUYỂN
- Công ty A: tuyển ... người, lương ..., yêu cầu ...

QUY ĐỊNH
- Giờ làm: ...
- Chấm công, nghỉ phép: ...`;

export function AiKnowledgeSettings() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientApi<KnowledgeConfig>("/ai-assistant/config")
      .then((c) => {
        setName(c.assistant_name);
        setPersona(c.persona);
        setKnowledge(c.knowledge);
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được sổ tay"));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const c = await clientApi<KnowledgeConfig>("/ai-assistant/knowledge", {
        method: "PUT",
        body: JSON.stringify({ assistant_name: name, persona, knowledge }),
      });
      setName(c.assistant_name);
      toast.success("Đã lưu — trợ lý dùng thông tin mới ngay từ câu hỏi tiếp theo");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded && !error) return <p className="text-xs text-slate-400">Đang tải…</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
        Trợ lý đọc các thông tin dưới đây mỗi lần trả lời — sửa xong bấm Lưu là dùng ngay. Danh sách nhân viên, nhóm, Leader, chức
        vụ phần mềm <b>tự lấy</b> từ trang Tài khoản (không gửi SĐT, CCCD, số tài khoản). Không ghi mật khẩu hay thông tin bí mật vào
        đây.
      </p>
      <Field label="Tên trợ lý">
        <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Trợ lý Đại Việt" />
      </Field>
      <Field label="Trợ lý là ai" hint="Trả lời khi được hỏi “bạn là ai”, “ai tạo ra bạn”; cách xưng hô.">
        <Textarea rows={4} maxLength={4000} value={persona} onChange={(e) => setPersona(e.target.value)} placeholder={PERSONA_SAMPLE} />
      </Field>
      {!persona && (
        <button type="button" onClick={() => setPersona(PERSONA_SAMPLE)} className="-mt-2 self-start text-xs text-brand-600 hover:underline">
          Dùng mẫu gợi ý
        </button>
      )}
      <Field
        label="Sổ tay công ty"
        hint={`Giới thiệu công ty, ban lãnh đạo, phòng ban, đơn hàng, quy định… Viết tự nhiên như dặn nhân viên mới. ${knowledge.length.toLocaleString("vi-VN")}/30.000 ký tự.`}
      >
        <Textarea rows={12} maxLength={30000} value={knowledge} onChange={(e) => setKnowledge(e.target.value)} placeholder={KNOWLEDGE_SAMPLE} />
      </Field>
      {!knowledge && (
        <button type="button" onClick={() => setKnowledge(KNOWLEDGE_SAMPLE)} className="-mt-2 self-start text-xs text-brand-600 hover:underline">
          Chèn khung mẫu để điền
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu thông tin trợ lý"}
        </Button>
      </div>
    </div>
  );
}

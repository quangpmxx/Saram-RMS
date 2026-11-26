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
  sales_playbook: string;
  allow_chitchat: boolean;
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

/** Khung gợi ý kịch bản Sale (2026-11-26) — Admin thay bằng kịch bản thật của công ty. */
const PLAYBOOK_SAMPLE = `NGUYÊN TẮC CHUNG
- Xưng em, gọi anh/chị; nói chậm, thân thiện; luôn chốt lịch hẹn phỏng vấn cụ thể (ngày, giờ, điểm đón).
- Không hứa lương / quyền lợi ngoài thông tin đơn hàng.

MỞ ĐẦU CUỘC GỌI
- Câu mẫu: "Em chào anh/chị, em là ... bên công ty Đại Việt, anh/chị vừa để lại thông tin tìm việc ..."

TÌNH HUỐNG THƯỜNG GẶP
1. Lao động chê lương thấp
- Cách xử lý: ...
- Câu mẫu: "..."

2. Lao động sợ xa / hỏi chỗ ở, xe đưa đón
- Cách xử lý: ...
- Câu mẫu: "..."

3. Lao động không nghe máy / hẹn gọi lại
- Cách xử lý: ...

4. Lao động hẹn rồi bùng phỏng vấn
- Cách xử lý: ...

5. Lao động hỏi phí, sợ lừa đảo
- Cách xử lý: ...

CHỐT HẸN
- Câu mẫu: "..."`;

export function AiKnowledgeSettings() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [playbook, setPlaybook] = useState("");
  const [chitchat, setChitchat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientApi<KnowledgeConfig>("/ai-assistant/config")
      .then((c) => {
        setName(c.assistant_name);
        setPersona(c.persona);
        setKnowledge(c.knowledge);
        setPlaybook(c.sales_playbook ?? "");
        setChitchat(c.allow_chitchat);
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
        body: JSON.stringify({ assistant_name: name, persona, knowledge, sales_playbook: playbook, allow_chitchat: chitchat }),
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
      <Field
        label="Kỹ năng Sale & xử lý tình huống lao động"
        hint={`Kịch bản gọi điện, cách tư vấn, cách xử lý khi lao động chê lương, sợ xa, bùng hẹn… Sale hỏi trợ lý sẽ được hướng dẫn và đưa câu nói mẫu theo đúng phần này. ${playbook.length.toLocaleString("vi-VN")}/30.000 ký tự.`}
      >
        <Textarea rows={12} maxLength={30000} value={playbook} onChange={(e) => setPlaybook(e.target.value)} placeholder={PLAYBOOK_SAMPLE} />
      </Field>
      {!playbook && (
        <button type="button" onClick={() => setPlaybook(PLAYBOOK_SAMPLE)} className="-mt-2 self-start text-xs text-brand-600 hover:underline">
          Chèn khung mẫu để điền
        </button>
      )}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
        <input
          type="checkbox"
          checked={chitchat}
          onChange={(e) => setChitchat(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-600"
        />
        <span>
          <span className="block text-sm font-medium text-slate-800">Cho phép trò chuyện ngoài lề</span>
          <span className="block text-xs text-slate-500">
            Nhân viên tâm sự, hỏi linh tinh được. Tắt thì trợ lý chỉ hỗ trợ công việc. Gói miễn phí dùng chung lượt cho cả công ty — bật
            khi đã có tín dụng / thanh toán Google Cloud thì tốt hơn.
          </span>
        </span>
      </label>
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

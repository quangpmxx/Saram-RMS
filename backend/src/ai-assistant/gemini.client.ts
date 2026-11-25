/**
 * Gọi Google Gemini qua REST (generateContent) — không thêm thư viện. Khoá gửi trong header
 * x-goog-api-key (không đặt trên URL để khỏi lọt vào log).
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  [key: string]: unknown; // thoughtSignature… phải gửi lại nguyên vẹn
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function geminiGenerate(
  apiKey: string,
  model: string,
  body: {
    systemInstruction?: string;
    contents: GeminiContent[];
    tools?: GeminiFunctionDeclaration[];
  },
): Promise<GeminiContent> {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        ...(body.systemInstruction
          ? { systemInstruction: { parts: [{ text: body.systemInstruction }] } }
          : {}),
        contents: body.contents,
        ...(body.tools?.length
          ? { tools: [{ functionDeclarations: body.tools }] }
          : {}),
        generationConfig: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: { content?: GeminiContent }[];
  };
  if (!res.ok) {
    throw new GeminiError(
      json.error?.message ?? `Gemini trả lỗi ${res.status}`,
      res.status,
    );
  }
  const content = json.candidates?.[0]?.content;
  if (!content?.parts?.length) {
    return { role: 'model', parts: [{ text: '' }] };
  }
  return { role: 'model', parts: content.parts };
}

/** Danh sách mô hình Gemini khoá này dùng được (chỉ mô hình trò chuyện có generateContent). */
export async function geminiListModels(
  apiKey: string,
): Promise<{ id: string; label: string }[]> {
  const res = await fetch(`${BASE}?pageSize=200`, {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    models?: {
      name: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }[];
  };
  if (!res.ok) {
    throw new GeminiError(
      json.error?.message ?? `Gemini trả lỗi ${res.status}`,
      res.status,
    );
  }
  return (json.models ?? [])
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        m.name.includes('gemini') &&
        !/embedding|tts|image|audio|live|robotics|computer-use/i.test(m.name),
    )
    .map((m) => ({
      id: m.name.replace(/^models\//, ''),
      label: m.displayName ?? m.name.replace(/^models\//, ''),
    }));
}

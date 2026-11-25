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

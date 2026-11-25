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
    /** Mức suy nghĩ (Gemini 3): "minimal" nhanh hơn ~6 lần cho câu hỏi tra số (đo 2026-11-25: 5,3s → 0,8s). */
    thinkingLevel?: string;
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
        generationConfig: {
          temperature: 0.2,
          ...(body.thinkingLevel
            ? { thinkingConfig: { thinkingLevel: body.thinkingLevel } }
            : {}),
        },
      }),
      // Google quá tải hay "treo" rất lâu (đo được 38s) → 20s thì bỏ, chuyển mô hình dự phòng.
      signal: AbortSignal.timeout(20_000),
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

/**
 * Đọc thành giọng nói (Gemini TTS, 2026-11-25). Trả WAV (PCM 16-bit mono, thường 24 kHz) để trình
 * duyệt phát thẳng — giọng giống nhau trên mọi máy (Chrome Windows không có giọng tiếng Việt).
 */
export async function geminiSpeak(
  apiKey: string,
  model: string,
  text: string,
  voiceName: string,
): Promise<Buffer> {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: {
      content?: {
        parts?: { inlineData?: { data?: string; mimeType?: string } }[];
      };
    }[];
  };
  if (!res.ok) {
    throw new GeminiError(
      json.error?.message ?? `Gemini trả lỗi ${res.status}`,
      res.status,
    );
  }
  const inline = json.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  )?.inlineData;
  if (!inline?.data) throw new GeminiError('Gemini không trả âm thanh', 502);
  const rate = Number(/rate=(\d+)/.exec(inline.mimeType ?? '')?.[1] ?? 24000);
  return pcmToWav(Buffer.from(inline.data, 'base64'), rate);
}

/** Thêm đầu WAV 44 byte cho PCM 16-bit mono. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

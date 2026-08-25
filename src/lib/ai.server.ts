// Thin, replaceable AI provider layer. Swap the implementation here to change
// providers without touching any feature code.

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

/**
 * Transcription model (OpenAI, served through the Lovable AI Gateway).
 * Change this one constant to switch transcription models later.
 */
export const TRANSCRIPTION_MODEL = "openai/gpt-4o-transcribe";
/** Reasoning model used for timing alignment, translation and analysis. */
export const REASONING_MODEL = "google/gemini-3.7-flash";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

export class AiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export interface AiProvider {
  /** Speech-to-text for one audio file. Returns the plain transcript. */
  transcribe(args: { audio: Blob; filename: string; language?: string | undefined }): Promise<string>;
  /** Analyze audio (timing/speakers) and return JSON. */
  analyzeAudio(args: { audioBase64: string; format: string; prompt: string }): Promise<unknown>;
  /** General text->JSON reasoning call. */
  reason(args: { system: string; prompt: string }): Promise<unknown>;
}

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError("Transcription is not configured on the server (missing AI API key).", 500);
  return key;
}

function gatewayError(status: number, body: string, what: string): AiError {
  console.error(`[ai] ${what} failed: ${status} ${body.slice(0, 800)}`);
  if (status === 401) return new AiError("Unauthorized AI request — the server API key is invalid.", 502);
  if (status === 402) return new AiError("AI credits are exhausted for this workspace.", 402);
  if (status === 403) return new AiError("AI access is blocked for this workspace.", 403);
  if (status === 413) return new AiError("The audio chunk is too large to transcribe.", 413);
  if (status === 429) return new AiError("AI is rate limited right now. Please retry in a moment.", 429);
  if (status === 400) return new AiError(`AI rejected the request: ${body.slice(0, 200)}`, 400);
  return new AiError(`${what} failed (${status}).`, 502);
}

async function chat(model: string, messages: unknown[]): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""), "AI request");
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

export function parseJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

/** Default provider — Lovable AI Gateway (OpenAI for STT, Gemini for analysis). */
export const aiProvider: AiProvider = {
  async transcribe({ audio, filename, language }) {
    const form = new FormData();
    form.append("model", TRANSCRIPTION_MODEL);
    form.append("file", audio, filename);
    // NOTE: the current OpenAI transcription models exposed here support only
    // `json`/`text` response formats — no word/segment timestamps. Timing is
    // therefore derived from the real audio in a second alignment pass
    // (see `analyzeAudio`), never invented from text length.
    if (language) form.append("language", language);

    const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
    });
    if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""), "Transcription");
    const json = (await res.json()) as { text?: string };
    return (json.text ?? "").trim();
  },

  async analyzeAudio({ audioBase64, format, prompt }) {
    const content = await chat(REASONING_MODEL, [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "input_audio", input_audio: { data: audioBase64, format } },
        ],
      },
    ]);
    return parseJson(content);
  },

  async reason({ system, prompt }) {
    const content = await chat(REASONING_MODEL, [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ]);
    return parseJson(content);
  },
};

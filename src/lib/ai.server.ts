// Thin, replaceable AI provider layer. Swap the implementation here to change
// providers without touching any feature code.

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

export interface AiProvider {
  /** Analyze audio (transcription, speaker labels, timestamps) and return JSON. */
  analyzeAudio(args: { audioBase64: string; format: string; prompt: string }): Promise<unknown>;
  /** General text->JSON reasoning call. */
  reason(args: { system: string; prompt: string }): Promise<unknown>;
}

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI provider is not configured");
  return key;
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is rate limited right now. Please retry in a moment.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }
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

/** Default provider — Lovable AI Gateway (Gemini for audio + analysis). */
export const aiProvider: AiProvider = {
  async analyzeAudio({ audioBase64, format, prompt }) {
    const content = await chat("google/gemini-3.7-flash", [
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
    const content = await chat("google/gemini-3.7-flash", [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ]);
    return parseJson(content);
  },
};

import { createFileRoute } from "@tanstack/react-router";
import { aiProvider } from "@/lib/ai.server";

export interface RawSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const audio = form.get("audio");
          const sourceLang = String(form.get("sourceLang") ?? "Russian");
          if (!(audio instanceof File) || audio.size < 2048) {
            return Response.json({ error: "No usable audio was extracted from this video." }, { status: 400 });
          }
          if (audio.size > 24 * 1024 * 1024) {
            return Response.json({ error: "That clip is too long. Try a video under ~10 minutes." }, { status: 413 });
          }

          const bytes = new Uint8Array(await audio.arrayBuffer());
          const prompt = [
            `Transcribe the ${sourceLang} speech in this audio.`,
            "Split it into natural dialogue sentences and detect distinct speakers when possible.",
            'Return STRICT JSON only: {"segments":[{"speaker":"Speaker 1","text":"...","start":1.2,"end":4.8}]}',
            "start/end are seconds from the beginning of the audio. Use short, real sentences.",
            "If there is no intelligible speech, return {\"segments\":[]}.",
          ].join(" ");

          const result = (await aiProvider.analyzeAudio({
            audioBase64: toBase64(bytes),
            format: "wav",
            prompt,
          })) as { segments?: RawSegment[] } | RawSegment[];

          const segments = Array.isArray(result) ? result : (result.segments ?? []);
          const clean: RawSegment[] = segments
            .filter((s) => s && typeof s.text === "string" && s.text.trim().length > 0)
            .map((s, i) => ({
              speaker: String(s.speaker ?? `Speaker ${(i % 2) + 1}`),
              text: String(s.text).trim(),
              start: Number(s.start) || 0,
              end: Number(s.end) || (Number(s.start) || 0) + 2,
            }));

          return Response.json({ segments: clean });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Analysis failed";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});

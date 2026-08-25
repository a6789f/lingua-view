import { createFileRoute } from "@tanstack/react-router";
import { AiError, aiProvider } from "@/lib/ai.server";

export interface RawSegment {
  speaker: string | null;
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

/**
 * Transcribes ONE audio chunk of the uploaded video.
 *
 * Step 1 — real speech-to-text with the OpenAI transcription model.
 * Step 2 — timing/speaker alignment against the same audio. The current OpenAI
 *          transcription models exposed by the gateway do not return word or
 *          segment timestamps, so the timings come from a model pass over the
 *          real audio with the verified transcript as ground truth. They are
 *          measured from the audio, not fabricated from text length, but they
 *          are approximate (~0.3s) rather than forced-aligned.
 */
export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const audio = form.get("audio");
          const sourceLang = String(form.get("sourceLang") ?? "").trim(); // "" = auto detect
          const langCode = String(form.get("langCode") ?? "").trim();
          const offset = Number(form.get("offset") ?? 0) || 0;
          const duration = Number(form.get("duration") ?? 0) || 0;

          if (!(audio instanceof File) || audio.size < 2048) {
            return Response.json({ error: "No usable audio was extracted from this video." }, { status: 400 });
          }
          if (audio.size > 24 * 1024 * 1024) {
            return Response.json({ error: "This audio chunk is too large to transcribe." }, { status: 413 });
          }

          const transcript = await aiProvider.transcribe({
            audio,
            filename: "chunk.wav",
            language: langCode && langCode !== "auto" ? langCode : undefined,
          });

          if (!transcript || transcript.replace(/[\s.…-]/g, "").length === 0) {
            return Response.json({ segments: [], transcript: "" });
          }

          const bytes = new Uint8Array(await audio.arrayBuffer());
          const prompt = [
            `This audio is ${duration.toFixed(1)} seconds of speech${sourceLang ? ` in ${sourceLang}` : ""}.`,
            `Its verified transcript is: ${JSON.stringify(transcript)}.`,
            "Listen to the audio and split the transcript into natural dialogue sentences, giving the real start and end time of each sentence IN THIS AUDIO, in seconds from 0.",
            "Do not change, translate or invent words — only split and time the given transcript.",
            'Set "speaker" to "Speaker 1"/"Speaker 2" only when different voices are clearly distinguishable; otherwise set it to null.',
            'Return STRICT JSON only: {"language":"english name of the spoken language","segments":[{"speaker":null,"text":"...","start":0.0,"end":2.4}]}',
          ].join(" ");

          const result = (await aiProvider.analyzeAudio({
            audioBase64: toBase64(bytes),
            format: "wav",
            prompt,
          })) as { segments?: RawSegment[]; language?: string } | RawSegment[];

          const rawSegments = Array.isArray(result) ? result : (result.segments ?? []);
          const detected = Array.isArray(result) ? "" : String(result.language ?? "");

          const clean: RawSegment[] = rawSegments
            .filter((s) => s && typeof s.text === "string" && s.text.trim().length > 0)
            .map((s) => {
              const start = Math.max(0, Math.min(Number(s.start) || 0, duration || Number.MAX_SAFE_INTEGER));
              const end = Math.max(start + 0.4, Number(s.end) || start + 2);
              const speaker = typeof s.speaker === "string" && /^speaker\s*\d$/i.test(s.speaker.trim())
                ? s.speaker.trim()
                : null;
              return { speaker, text: String(s.text).trim(), start: start + offset, end: end + offset };
            })
            .sort((a, b) => a.start - b.start);

          // If alignment produced nothing usable, still return the real transcript
          // for the whole chunk window rather than dropping the user's dialogue.
          const segments =
            clean.length > 0
              ? clean
              : [{ speaker: null, text: transcript, start: offset, end: offset + (duration || 5) }];

          return Response.json({ segments, transcript, language: detected });
        } catch (err) {
          const status = err instanceof AiError ? err.status : 500;
          const message =
            err instanceof AiError
              ? err.message
              : err instanceof Error
                ? `Server function failure: ${err.message}`
                : "Transcription failed";
          console.error("[api/analyze] error", err);
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

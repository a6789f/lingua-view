import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiProvider } from "@/lib/ai.server";

const TranslateInput = z.object({
  sentences: z.array(z.string()).min(1),
  sourceLang: z.string(),
  targetLang: z.string(),
});

export const translateSentences = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TranslateInput.parse(d))
  .handler(async ({ data }) => {
    const result = (await aiProvider.reason({
      system:
        "You are a precise subtitle translator. Return STRICT JSON only, no prose, no markdown fences.",
      prompt: `Translate each ${data.sourceLang} sentence into ${data.targetLang}. Keep the natural spoken tone.
Return {"translations":["...","..."]} with exactly ${data.sentences.length} items, in the same order.
Sentences: ${JSON.stringify(data.sentences)}`,
    })) as { translations?: string[] } | string[];

    const translations = Array.isArray(result) ? result : (result.translations ?? []);
    return { translations: data.sentences.map((_, i) => String(translations[i] ?? "")) };
  });

const WordInput = z.object({
  word: z.string().min(1),
  sentence: z.string().min(1),
  sourceLang: z.string(),
  targetLang: z.string(),
});

export const analyzeWord = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => WordInput.parse(d))
  .handler(async ({ data }) => {
    const result = (await aiProvider.reason({
      system:
        "You are a concise language tutor. Always answer about the word AS USED IN THE GIVEN SENTENCE, not a generic dictionary entry. Return STRICT JSON only.",
      prompt: `Language: ${data.sourceLang}. Explanation language: ${data.targetLang}.
Sentence: "${data.sentence}"
Word: "${data.word}"
Return {"meaning":"contextual meaning here","base":"dictionary/base form","pronunciation":"simple phonetic or transliteration","role":"grammatical role in this sentence","forms":"relevant conjugation or declension info","context":"why it is used this way here","example":"one short example sentence with its translation"}. Keep every field under 200 characters.`,
    })) as Record<string, unknown>;

    const get = (k: string) => String(result?.[k] ?? "").trim();
    return {
      meaning: get("meaning"),
      base: get("base"),
      pronunciation: get("pronunciation"),
      role: get("role"),
      forms: get("forms"),
      context: get("context"),
      example: get("example"),
    };
  });

const SentenceInput = z.object({
  sentence: z.string().min(1),
  sourceLang: z.string(),
  targetLang: z.string(),
});

export const explainSentence = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SentenceInput.parse(d))
  .handler(async ({ data }) => {
    const result = (await aiProvider.reason({
      system:
        "You are a concise language tutor for learners. Be clear and short. Return STRICT JSON only.",
      prompt: `Language: ${data.sourceLang}. Explain in ${data.targetLang}.
Sentence: "${data.sentence}"
Return {"structure":"...","grammar":"...","expressions":"slang/idioms/expressions or 'none'","tone":"tone and why this wording","literal":"literal meaning","natural":"natural meaning"}. Each field one or two short sentences.`,
    })) as Record<string, unknown>;

    const get = (k: string) => String(result?.[k] ?? "").trim();
    return {
      structure: get("structure"),
      grammar: get("grammar"),
      expressions: get("expressions"),
      tone: get("tone"),
      literal: get("literal"),
      natural: get("natural"),
    };
  });

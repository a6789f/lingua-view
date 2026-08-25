import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UploadZone } from "@/components/UploadZone";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { VocabularyPanel } from "@/components/VocabularyPanel";
import {
  AudioExtractionError,
  MAX_FILE_BYTES,
  RECOMMENDED_DURATION_SEC,
  extractWavChunks,
} from "@/lib/audio";
import { translateSentences } from "@/lib/xray.functions";
import {
  createVideo,
  insertSegments,
  LANGUAGES,
  langLabel,
  listVideos,
  rememberLocalVideo,
  type VideoRow,
} from "@/lib/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Language X-Ray — turn any video into a language lesson" },
      {
        name: "description",
        content:
          "Drop in a video and get AI transcription, timestamps, translations and word-by-word analysis in a cinematic player.",
      },
      { property: "og:title", content: "Language X-Ray" },
      {
        property: "og:description",
        content: "AI subtitles, translations and contextual word analysis layered over your videos.",
      },
    ],
  }),
  component: Home,
});

interface RawSegment {
  speaker: string | null;
  text: string;
  start: number;
  end: number;
}

const SOURCE_OPTIONS = [{ code: "auto", label: "Auto detect" }, ...LANGUAGES];
const TARGET_OPTIONS = [
  { code: "ar", label: "Arabic" },
  { code: "en", label: "English" },
  { code: "ru", label: "Russian" },
  ...LANGUAGES.filter((l) => !["ar", "en", "ru"].includes(l.code)),
];

function Home() {
  const navigate = useNavigate();
  const translate = useServerFn(translateSentences);

  const [sourceLang, setSourceLang] = useState("ru");
  const [targetLang, setTargetLang] = useState("ar");
  const [stage, setStage] = useState<number | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [showVocab, setShowVocab] = useState(false);
  const lastFile = useRef<File | null>(null);

  useEffect(() => {
    listVideos()
      .then(setVideos)
      .catch(() => setVideos([]));
  }, []);

  async function process(file: File) {
    lastFile.current = file;
    setError(null);
    setDetail(null);
    setStage(0);
    let objectUrl: string | null = null;
    try {
      // 1. Preparing video — validate and read metadata.
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(
          `This file is ${(file.size / 1024 / 1024).toFixed(0)} MB. Please use a short clip (under ${
            MAX_FILE_BYTES / 1024 / 1024
          } MB) for this prototype.`,
        );
      }
      objectUrl = URL.createObjectURL(file);
      const duration = await readDuration(objectUrl);
      if (duration && duration > RECOMMENDED_DURATION_SEC) {
        setDetail(`${Math.round(duration / 60)} min clip — this may take a while`);
      }

      // 2. Extracting audio locally (only audio leaves the browser).
      setStage(1);
      const chunks = await extractWavChunks(file);

      // 3-5. Upload each chunk, transcribe it and align real timestamps.
      const sourceLabel = sourceLang === "auto" ? "" : langLabel(sourceLang);
      const segments: RawSegment[] = [];
      let detectedLanguage = "";
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        setStage(2);
        setDetail(`part ${i + 1} of ${chunks.length}`);
        const form = new FormData();
        form.append("audio", chunk.blob, `chunk-${i}.wav`);
        form.append("sourceLang", sourceLabel);
        form.append("langCode", sourceLang);
        form.append("offset", String(chunk.offset));
        form.append("duration", String(chunk.duration));

        setStage(3);
        let res: Response;
        try {
          res = await fetch("/api/analyze", { method: "POST", body: form });
        } catch (netErr) {
          throw new Error(
            `Network failure while uploading audio part ${i + 1} (${
              netErr instanceof Error ? netErr.message : "connection lost"
            }). Check your connection and retry.`,
          );
        }
        let payload: { segments?: RawSegment[]; error?: string; language?: string };
        try {
          payload = (await res.json()) as typeof payload;
        } catch {
          throw new Error(`The transcription service returned an unreadable response (HTTP ${res.status}).`);
        }
        if (!res.ok) throw new Error(payload.error ?? `Transcription failed (HTTP ${res.status}).`);
        setStage(4);
        if (payload.language && !detectedLanguage) detectedLanguage = payload.language;
        segments.push(...(payload.segments ?? []));
      }

      setDetail(null);
      if (segments.length === 0) {
        throw new Error("No speech was detected in this video's audio track.");
      }

      // 6. Translating the real transcript (text only — never the video).
      setStage(5);
      const { translations } = await translate({
        data: {
          sentences: segments.map((s) => s.text),
          sourceLang: sourceLabel || detectedLanguage || "the detected language",
          targetLang: langLabel(targetLang),
        },
      });

      // 7. Persist and prepare the X-Ray layer.
      setStage(6);
      const resolvedSource =
        sourceLang !== "auto"
          ? sourceLang
          : (LANGUAGES.find((l) => l.label.toLowerCase() === detectedLanguage.trim().toLowerCase())?.code ??
            sourceLang);
      const video = await createVideo({
        title: file.name.replace(/\.[^.]+$/, ""),
        original_lang: resolvedSource === "auto" ? (detectedLanguage || "auto") : resolvedSource,
        translation_lang: targetLang,
        duration_sec: duration,
      });
      await insertSegments(
        video.id,
        segments.map((s, i) => ({
          idx: i,
          speaker: s.speaker ?? "",
          text: s.text,
          translation: translations[i] ?? "",
          start_sec: s.start,
          end_sec: s.end,
        })),
      );
      rememberLocalVideo(video.id, objectUrl);
      navigate({ to: "/watch/$videoId", params: { videoId: video.id } });
    } catch (e) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setDetail(null);
      setError(
        e instanceof AudioExtractionError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Processing failed for an unknown reason.",
      );
    }
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-xray shadow-glow" />
          <span className="font-display text-sm font-semibold tracking-tight">Language X-Ray</span>
        </div>
        <button
          onClick={() => setShowVocab((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
        >
          My Vocabulary
        </button>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <h1 className="text-balance text-center text-4xl font-semibold leading-tight sm:text-5xl">
          Watch a film. <span className="text-primary">Read the language.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          Upload a video and Language X-Ray transcribes the dialogue, times it, translates it and lets you inspect any
          word in its real context — an intelligent layer over normal viewing.
        </p>

        {stage !== null ? (
          <div className="mt-12">
            <ProcessingScreen
              current={stage}
              detail={detail}
              error={error}
              onRetry={() => {
                const f = lastFile.current;
                if (f) void process(f);
              }}
              onCancel={() => {
                setStage(null);
                setError(null);
                setDetail(null);
              }}
            />
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <LangSelect
                label="Original / learning language"
                value={sourceLang}
                onChange={setSourceLang}
                options={SOURCE_OPTIONS}
              />
              <LangSelect
                label="Translation language"
                value={targetLang}
                onChange={setTargetLang}
                options={TARGET_OPTIONS}
              />
            </div>

            <div className="mt-6">
              <UploadZone onFile={process} />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Prototype limit: clips up to ~{RECOMMENDED_DURATION_SEC / 60} minutes work best.
            </p>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </>
        )}

        {showVocab && (
          <div className="mt-10 panel">
            <p className="border-b border-border px-5 py-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              My Vocabulary
            </p>
            <VocabularyPanel refreshKey={0} />
          </div>
        )}

        {videos.length > 0 && (
          <div className="mt-14">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Library</p>
            <ul className="mt-4 space-y-2">
              {videos.map((v) => (
                <li key={v.id}>
                  <Link
                    to="/watch/$videoId"
                    params={{ videoId: v.id }}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-elevated"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={[
                          "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                          v.is_demo
                            ? "border-border text-muted-foreground"
                            : "border-xray/40 text-xray",
                        ].join(" ")}
                      >
                        {v.is_demo ? "Demo" : "Upload"}
                      </span>
                      <span className="truncate text-sm">{v.title}</span>
                    </span>
                    <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                      {langLabel(v.original_lang)} → {langLabel(v.translation_lang)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function LangSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ code: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
      >
        {options.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function readDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => resolve(null);
    el.src = url;
  });
}
